"""Exact creation previews share their bytes with the actual thin scaffolder."""
import hashlib
import io
from contextlib import redirect_stdout, redirect_stderr
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT/'packages/create-vivary'), str(ROOT/'packages/tropo')]
import create_vivary as cv
import tropo


class ThinInitPreviewTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='vivary-preview-')
        self.addCleanup(self.temporary.cleanup)
        self.parent = Path(self.temporary.name).resolve()

    def test_preview_is_repeatable_and_does_not_create_absent_target(self):
        target = self.parent/'new-project'
        first = cv.plan_thin_workspace(target)
        self.assertEqual(first, cv.plan_thin_workspace(target))
        self.assertFalse(target.exists())
        self.assertEqual(list(self.parent.iterdir()), [])
        self.assertEqual(first['schema'], 'vivary.thin-init-plan/v1')
        self.assertEqual([row['path'] for row in first['files']],
            ['.gitignore','.vivary/context.md','.vivary/workspace.toml','AGENTS.md','STATE.md'])
        self.assertEqual(json.loads(json.dumps(first)), first)

    def test_exact_bytes_match_apply_and_doctor_across_supported_options(self):
        options = [{'preset': preset} for preset in cv.PRESETS]
        options += [{'adapters':['claude','agents']}, {'active_context':'cocoindex-code'}]
        for index, selected in enumerate(options):
            with self.subTest(selected=selected):
                target = self.parent/f'project-{index}'
                plan = cv.plan_thin_workspace(target, **selected)
                created = cv.scaffold_thin_workspace(target, repo_root=ROOT, **selected)
                self.assertEqual([str(path.relative_to(target)).replace(os.sep,'/') for path in created],
                    [row['path'] for row in plan['files']])
                self.assertEqual({str(p.relative_to(target)).replace(os.sep,'/') for p in target.rglob('*') if p.is_file()},
                    {row['path'] for row in plan['files']})
                for row in plan['files']:
                    data = (target/row['path']).read_bytes()
                    self.assertEqual(data, row['content'].encode('utf-8'))
                    self.assertEqual(len(data), row['bytes'])
                    self.assertEqual('sha256:'+hashlib.sha256(data).hexdigest(), row['sha256'])
                self.assertTrue(cv.doctor_workspace(target, repo_root=ROOT)['ok'])
                output=io.StringIO()
                with redirect_stdout(output), redirect_stderr(output):
                    status=tropo.main(['check','--root',str(target)])
                self.assertEqual(status,0,output.getvalue())

    def test_portable_content_and_target_bound_plan_are_distinct(self):
        for name in ('a','b'):
            (self.parent/name).mkdir()
        first = cv.plan_thin_workspace(self.parent/'a'/'same-name')
        second = cv.plan_thin_workspace(self.parent/'b'/'same-name')
        self.assertEqual(first['content_sha256'], second['content_sha256'])
        self.assertNotEqual(first['plan_sha256'], second['plan_sha256'])
        changed = cv.plan_thin_workspace(self.parent/'a'/'same-name', preset='writing')
        self.assertNotEqual(first['content_sha256'], changed['content_sha256'])
        self.assertNotEqual(first['plan_sha256'], changed['plan_sha256'])
        one = cv.plan_thin_workspace(self.parent/'adapters', adapters=['agents','claude'])
        two = cv.plan_thin_workspace(self.parent/'adapters', adapters=['claude','agents'])
        self.assertEqual(one, two)

    def test_creator_apply_binds_target_options_and_exact_retry(self):
        target = self.parent/'shared'
        plan = cv.plan_thin_workspace(target, preset='writing')
        wrong = cv.apply_thin_workspace(target, plan['plan_sha256'], preset='coding')
        self.assertEqual(wrong, {'code': 'plan-changed'})
        other = cv.apply_thin_workspace(
            self.parent/'other', plan['plan_sha256'], preset='writing'
        )
        self.assertEqual(other, {'code': 'plan-changed'})
        self.assertFalse(target.exists())
        self.assertFalse((self.parent/'other').exists())

        created = cv.apply_thin_workspace(
            target, plan['plan_sha256'], preset='writing', repo_root=ROOT
        )
        self.assertEqual(created['code'], 'created')
        reviewed = (target/'AGENTS.md').read_bytes()
        before = (target/'AGENTS.md').stat().st_mtime_ns
        replay = cv.apply_thin_workspace(
            target, plan['plan_sha256'], preset='writing', repo_root=ROOT
        )
        self.assertEqual(replay['code'], 'already-created')
        self.assertEqual((target/'AGENTS.md').read_bytes(), reviewed)
        self.assertEqual((target/'AGENTS.md').stat().st_mtime_ns, before)

        (target/'extra.txt').write_text('keep me\n', encoding='utf-8')
        with self.assertRaisesRegex(cv.ScaffoldError, 'init requires a new or empty directory'):
            cv.apply_thin_workspace(
                target, plan['plan_sha256'], preset='writing', repo_root=ROOT
            )
        self.assertEqual((target/'extra.txt').read_text(), 'keep me\n')

    def test_creator_rechecks_rendered_content_at_write_boundary(self):
        target = self.parent/'drift'
        accepted = cv.plan_thin_workspace(target)['plan_sha256']
        render = cv._thin_context_doc
        calls = 0
        def change_between_checks(project, preset):
            nonlocal calls
            calls += 1
            text = render(project, preset)
            return text if calls == 1 else text + 'changed after approval\n'
        with mock.patch.object(cv, '_thin_context_doc', side_effect=change_between_checks):
            with self.assertRaisesRegex(cv.ScaffoldError, 'plan changed before writing'):
                cv.apply_thin_workspace(target, accepted, repo_root=ROOT)
        self.assertFalse(target.exists())

    def test_adapter_options_are_snapshotted_before_target_validation(self):
        target=self.parent/'snapshot'
        adapters=['agents']
        validate=cv._validate_thin_init_target
        def change_callers_options(*args, **kwargs):
            validate(*args, **kwargs)
            adapters.append('claude')
        with mock.patch.object(cv,'_validate_thin_init_target',side_effect=change_callers_options):
            plan=cv.plan_thin_workspace(target,adapters=adapters)
        self.assertEqual(adapters,['agents','claude'])
        self.assertEqual(plan['adapters'],['agents'])
        self.assertIn('.agents/skills/vivary/SKILL.md',[row['path'] for row in plan['files']])
        self.assertFalse(any(row['path'].startswith('.claude/') for row in plan['files']))
        self.assertFalse(target.exists())

    def test_empty_target_is_unchanged_and_occupied_target_refuses(self):
        target=self.parent/'empty'
        target.mkdir()
        before=target.stat().st_mtime_ns
        cv.plan_thin_workspace(target)
        self.assertEqual(list(target.iterdir()), [])
        self.assertEqual(target.stat().st_mtime_ns, before)
        original=b'preserve these bytes\r\n'
        (target/'user.txt').write_bytes(original)
        with self.assertRaises(cv.ScaffoldError):
            cv.plan_thin_workspace(target)
        self.assertEqual((target/'user.txt').read_bytes(), original)
        self.assertEqual([p.name for p in target.iterdir()], ['user.txt'])

    def test_invalid_options_refuse_without_creating_target(self):
        target=self.parent/'invalid'
        for options in [{'preset':'unknown'}, {'adapters':['unknown']},
                        {'adapters':['agents','agents']}, {'active_context':'unknown'},
                        {'preset':'writing','active_context':'cocoindex-code'}]:
            with self.subTest(options=options), self.assertRaises(cv.ScaffoldError):
                cv.plan_thin_workspace(target, **options)
            self.assertFalse(target.exists())

    @unittest.skipIf(os.name=='nt', 'real symlink proof runs in Habitat')
    def test_symlink_target_and_ancestor_refuse(self):
        outside=self.parent/'outside'
        outside.mkdir()
        alias=self.parent/'alias'
        alias.symlink_to(outside, target_is_directory=True)
        for target in (alias, alias/'new'):
            with self.subTest(target=target), self.assertRaises(cv.ScaffoldError):
                cv.plan_thin_workspace(target)
        self.assertEqual(list(outside.iterdir()), [])


if __name__=='__main__':
    unittest.main()
