/**
 * Fontsource packages ship CSS as their entry point and carry no type
 * declarations — declare them as side-effect modules so `tsc` (which never
 * sees Vite's CSS handling) accepts the imports.
 */

declare module '@fontsource/*'
declare module '@fontsource-variable/*'
