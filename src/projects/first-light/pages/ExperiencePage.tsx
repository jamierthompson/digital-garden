import FirstLightExperience from "../experience";

/**
 * The thin page that mounts the `first-light` interactive experience — the
 * component-vs-page split, where a project would add page-level chrome around its experience.
 *
 * No route mounts it: `first-light` embeds its experience inline in the essay (the
 * `/[slug]` route resolves the module and renders `Experience` directly). Kept as the
 * scaffold a richer project's route would mount.
 */
export default function ExperiencePage() {
  return <FirstLightExperience />;
}
