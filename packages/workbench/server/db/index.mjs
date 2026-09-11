import { createGetDb } from "@agent-native/core/db";
import * as schema from "./schema.mjs";

export const getDb = createGetDb(schema);
