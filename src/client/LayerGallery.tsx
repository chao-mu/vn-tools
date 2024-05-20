import { LayerInfo } from "src/common/names";

const LayerDetails = ({ layer }: { layer: LayerInfo }) => <span>{layer.path}</span>;

const Image = ({ path }: { path: string }) => (
    <img src={path} width={100} height={100} alt="" />
);

interface LayerGalleryProps {
    layers: LayerInfo[];
}

export const LayerGallery = ({ layers }: LayerGalleryProps) => (
    <html>
        <head>
            <title>Layer Gallery</title>
            <style>
                {`
                  img {
                    max-width: 100%;
                    height: auto;
                  }
                `}
            </style>
        </head>
        <body
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
            }}
        >
            {layers.map((layer, index) => (
                <div
                    key={index}
                    style={{
                        border: "solid",
                        alignItems: "center",
                        display: "flex",
                        flexDirection: "column",
                        padding: "0.5rem",
                    }}
                >
                    <LayerDetails layer={layer} />
                    <Image path={layer.path} />
                </div>
            ))}
        </body>
    </html>
);
