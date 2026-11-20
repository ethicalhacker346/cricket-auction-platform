import {
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";

type Props = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "className" | "onLoad" | "onError"
> & {
  alt: string;
  /** The wrapper reserves space; its fallback never depends on a network request. */
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
};

/**
 * A stable image surface, including before load and after a failed request.
 * The keyed inner component also resets correctly when a URL/srcset changes.
 * No timer can remove the fallback before the browser has a usable image.
 */
export function ResilientImage(props: Props) {
  return (
    <ImageSurface
      key={`${props.src}|${props.srcSet}|${props.sizes}`}
      {...props}
    />
  );
}

function ImageSurface({
  alt,
  className = "",
  imageClassName = "",
  fallback,
  width,
  height,
  style,
  ...image
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    // Cached images can finish before React attaches its load handler.
    const element = ref.current;
    if (element?.complete)
      setState(element.naturalWidth > 0 ? "ready" : "error");
  }, []);

  return (
    <span
      className={`gb-media ${className}`}
      style={{
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
        ...style,
      }}
      data-image-state={state}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <span className="gb-media__fallback" aria-hidden="true">
        {fallback}
      </span>
      {state !== "error" && (
        <img
          {...image}
          ref={ref}
          width={width}
          height={height}
          alt=""
          aria-hidden="true"
          className={`gb-media__image ${imageClassName}`}
          decoding={image.decoding ?? "async"}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </span>
  );
}
