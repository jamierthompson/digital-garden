/**
 * A parse-time inline `<script>`, rendered flash-free-safely on both server and client.
 *
 * Straight from Next's *Preventing flash before hydration* guide
 * (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`,
 * "Extracting a reusable component"): React warns in development when a component renders a
 * `<script>`, so the type is `text/javascript` on the server (where the script must execute
 * during HTML parse) and `text/plain` on the client (where it must NOT re-execute — the
 * re-applier owns soft navigation). `suppressHydrationWarning` accepts the type mismatch.
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
