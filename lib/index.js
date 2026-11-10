/**
 * Host half of the Slothy model picker bundle.
 *
 * The bundle has no Host-side service: the composer control is rendered by the
 * Client half (`client.js`), which reads the shared `ctx.modelDirectories`
 * session directory supplied by the shipped model-selection package. Keeping an
 * empty Host apply makes this bundle selectable in the profile without adding a
 * second model-selection implementation.
 *
 * Slothy 模型选择器 bundle 的宿主半侧：无宿主服务，全部渲染由 Client 半侧完成。
 */
export function apply() {}
