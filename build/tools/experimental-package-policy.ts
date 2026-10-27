/**
 * Experimental package identities, reduced to the rule this standalone repository
 * can actually observe.
 *
 * The vendored monorepo file carried three more branches: a retained-npm-name
 * exception table (`packages/experimental/<dir>` → an older published name), a
 * package-owned record-namespace derivation, and a publication policy keyed on
 * `packages/experimental/<dir>` directories. None of them can take a meaningful
 * branch here, so all three are gone:
 *
 * - This repository has no `packages/` tree at all, so both directory-keyed
 *   helpers were unreachable by construction.
 * - Only two exports have consumers outside this file (`grep -rn` over the repo,
 *   excluding `node_modules/` and `lib/`): `isExperimentalPackageName`
 *   (`build/tools/tsdown.client.ts`, `build/tools/bundle-input-isolation.ts`)
 *   and `hasExperimentalPackageReference` (`bundle-input-isolation.ts`). Nothing
 *   imported the record-namespace or publication helpers.
 * - The retained-name table cannot match anything either: those ten npm names
 *   appear nowhere outside this file, and none of them is installed under
 *   `node_modules/`, so no bundler input can ever hit one. Keeping it would just
 *   make a future dependency that happens to share such a name fail with an
 *   "experimental input" error that no longer explains anything.
 *
 * Behaviour is therefore unchanged, which is the point: `bundle-input-isolation.ts`
 * exits early for an experimental *engine* and throws if an experimental *input*
 * leaks in, and this repository's own package is not experimental, so its client
 * bundle takes exactly the same path as before. The surviving rule — the reserved
 * npm namespace prefix — is the only one with a live meaning: never let a
 * `@deepseek-ai/dsh-experimental-*` package into a shipped bundle. If a
 * `packages/experimental/` tree ever lands here, lift the deleted branches back
 * from the monorepo rather than re-inventing them.
 */

/** npm namespace reserved for experimental capabilities. */
export const EXPERIMENTAL_PACKAGE_NAME_PREFIX = '@deepseek-ai/dsh-experimental-'

/**
 * Identify an experimental npm package by its name alone.
 * @param name - complete npm package name, without a version or subpath.
 * @returns Whether the name uses the experimental prefix.
 */
export function isExperimentalPackageName(name: string): boolean {
  return name.startsWith(EXPERIMENTAL_PACKAGE_NAME_PREFIX)
}

/**
 * Find experimental identities in module ids, paths, subpaths, or npm alias specifications.
 * @param reference - package reference or bundler/runtime module identifier.
 * @returns Whether a delimited package name identifies an experimental capability.
 */
export function hasExperimentalPackageReference(reference: string): boolean {
  const normalized = reference.replaceAll('\\', '/')
  return [...normalized.matchAll(/(?:^|[/:\u0000])(@deepseek-ai\/[^/@?#:\s]+)(?=$|[/@?#:])/g)]
    .some(([, name]) => name !== undefined && isExperimentalPackageName(name))
}
