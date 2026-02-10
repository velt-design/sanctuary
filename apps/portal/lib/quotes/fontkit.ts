// Local vendored build of @pdf-lib/fontkit to avoid npm registry resolution in this workspace.
// Source: @pdf-lib/fontkit (UMD bundle).
import fontkit from '../../vendor/pdf-lib-fontkit/fontkit.umd.js';

export default fontkit as unknown as {
  create: (...args: any[]) => any;
};
