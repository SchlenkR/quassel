import type { CnFunction } from "cn";
import { createCn } from "cn/config";

export const cn: CnFunction = createCn({ prefix: "qsl" });
