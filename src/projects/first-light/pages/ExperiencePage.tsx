import FirstLightExperience from "../experience";

/**
 * The thin page that mounts the `first-light` interactive experience (§4.1, [D20]).
 *
 * `experience.tsx` is the component; a thin page mounts it — that split is the [D20]
 * clarification of §4.1's `experience.tsx`-vs-`pages/` ambiguity. The page is where a
 * project would add page-level chrome (a header, surrounding layout) around its
 * experience; for the dead-simple slice it just renders the experience directly.
 */
export default function ExperiencePage() {
  return <FirstLightExperience />;
}
