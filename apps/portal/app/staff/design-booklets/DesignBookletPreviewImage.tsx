import type { CSSProperties } from "react";
import type {
  DesignBookletAssetDisplayHandler,
  DesignBookletPreviewAsset,
} from "./previewAssets";
import styles from "./designBookletPreviewImage.module.css";

type Props = {
  asset: DesignBookletPreviewAsset;
  alt: string;
  className?: string;
  imageClassName?: string;
  imageStyle?: CSSProperties;
  tone?: "olive" | "paper";
  showEmptyLabel?: boolean;
  onDisplayState: DesignBookletAssetDisplayHandler;
};

export default function DesignBookletPreviewImage({
  asset,
  alt,
  className,
  imageClassName,
  imageStyle,
  tone = "olive",
  showEmptyLabel = false,
  onDisplayState,
}: Props) {
  const stateLabel =
    asset.state === "loading"
      ? "Loading image..."
      : asset.state === "error"
        ? asset.errorMessage || "Image could not be displayed"
        : asset.state === "empty" && showEmptyLabel
          ? "No image added"
          : null;

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-image-state={asset.state}
      data-image-tone={tone}
    >
      {asset.src ? (
        <img
          className={imageClassName}
          style={imageStyle}
          src={asset.src}
          alt={alt}
          onLoad={() => onDisplayState(asset.id, asset.src, "ready")}
          onError={() => onDisplayState(asset.id, asset.src, "error")}
        />
      ) : null}
      {stateLabel ? (
        <span
          className={styles.state}
          role={asset.state === "error" ? "alert" : "status"}
        >
          {asset.state === "loading" ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : null}
          <span>{stateLabel}</span>
        </span>
      ) : null}
    </div>
  );
}
