import { getImageProps } from "next/image";

// Product photos from Supabase go through Next's image optimiser, so a phone gets a
// smaller file sized for its screen (and cached for a year) instead of the original.
// `sizes` says how wide the photo is shown, like the <img sizes> attribute.
// Anything else (for example a photo being uploaded) is used as it is.
export function photo(src, sizes) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//.test(src || ""))
    return { src };
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

// How wide photos are shown in each place.
export const PHOTO_SIZES = {
  hero: "(max-width: 780px) 100vw, 50vw",
  card: "(max-width: 560px) 50vw, (max-width: 1000px) 33vw, 25vw",
  gallery: "(max-width: 1000px) 100vw, 55vw",
  thumb: "96px",
  // The blurred copy behind a whole photo: the smallest size is enough.
  backdrop: "48px",
};
