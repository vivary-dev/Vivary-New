import { register } from "node:module";
register(new URL("./native-http-dependency-loader.mjs", import.meta.url), {
  data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential — Reviewed installed Core package manifest path.
});
