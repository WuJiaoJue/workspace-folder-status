/**
 * 由 devkit/banner.mjs 生成（可重复运行，内容一致）。
 * 目的：在宿主日志里回答两件事 —— 这个进程跑的是哪一次构建（产物 mtime），
 * 以及刚那次热重载有没有真的把模块换进来（banner 会随 apply 再打一行）。
 * 自包含：插件发布只带自己的文件，不能 import 工作区外的东西。
 */
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
/** 由调用方把自己的 import.meta.url 传进来：谁被加载就报谁的 mtime，最准。 */
export function artifactTime(selfUrl) {
    if (!selfUrl)
        return 'unknown';
    try {
        return statSync(fileURLToPath(selfUrl)).mtime.toISOString();
    }
    catch {
        return 'unreadable';
    }
}
export function applyBanner(pluginName, selfUrl) {
    return `[${pluginName}] apply called; artifact mtime=${artifactTime(selfUrl)} pid=${process.pid}`;
}
//# sourceMappingURL=build-stamp.js.map