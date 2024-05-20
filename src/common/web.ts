// Node
import fs from "fs";

// react-dom/server
import { renderToStaticMarkup } from "react-dom/server";

export function render(outPath: string, node: React.ReactNode) {
    const html = renderToStaticMarkup(node);

    fs.writeFileSync(outPath, html);
}
