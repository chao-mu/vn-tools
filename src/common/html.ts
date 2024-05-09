import htmlCreator from "html-creator";

import { LayerInfo } from "./names";

export function buildHTMLIndex(layers: LayerInfo[]) {
    const LayerDetails = ({ path }: LayerInfo) => ({
        type: "span",
        //content: `Posture: ${category}. Attribute: ${attribute}`,
        content: path,
    });
    const Image = (path: string) => ({
        type: "img",
        attributes: { src: path, width: 100, height: 100 },
    });

    const html = new htmlCreator([
        {
            type: "head",
            content: [
                {
                    type: "title",
                    content: "Generated HTML",
                },
                {
                    type: "style",
                    content: `
                img {
                  max-width: 100%;
                  height: auto;
                }
        `,
                },
            ],
        },
        {
            type: "body",
            attributes: {
                style: "display: grid; grid-template-columns: repeat( auto-fit, minmax(250px, 1fr) ); gap: 1rem;",
            },
            content: layers.map((layer) => ({
                type: "div",
                attributes: {
                    style: "border: solid; align-items: center; display: flex; flex-direction: column; padding: 0.5rem;",
                },
                content: [LayerDetails(layer), Image(layer.path)],
            })),
        },
    ]);

    return html.renderHTML();
}
