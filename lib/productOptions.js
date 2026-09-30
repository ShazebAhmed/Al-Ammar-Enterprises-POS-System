// A product's colours and sizes.
//
// The database, basket and orders use one flat list of options
// (products.variants), each with its own stock and a unique name:
//   colours only:  { name: "Black", color: "Black", stock, images? }
//   sizes only:    { name: "M", size: "M", stock }
//   both:          { name: "Black / M", color: "Black", size: "M", stock, images? }
// A colour's photos are listed on each of its options and are also part of
// products.images, after the main photos, so product cards and older pages keep
// working. `image` (the first colour photo) is kept for older pages too.
// Products saved before colours and sizes existed have options with only a
// name, a stock and maybe one `image`; they are read as colours when the
// options are called "Colour" (or have no name but have photos), and as sizes
// otherwise.

export const MAX_OPTIONS = 50; // the database's limit on options per product
export const COLOR_NAME_MAX = 20;
export const SIZE_NAME_MAX = 16;
export const OPTION_JOIN = " / ";
export const COLOR_LABEL = "Colour";
export const DEFAULT_SIZE_LABEL = "Size";

const COLOUR_WORD = /colou?r/i;
const clean = (text) => String(text ?? "").trim();
const lower = (text) => clean(text).toLowerCase();
const stockOf = (value) => Math.max(0, Math.floor(Number(value) || 0));
const unique = (list) => [...new Set(list)];

// What the second kind of option is called: "Colour / Size" → "Size".
export function sizeLabelOf(optionLabel) {
  const label = clean(optionLabel);
  const parts = label.split("/").map(clean);
  if (parts.length > 1 && COLOUR_WORD.test(parts[0]))
    return parts[1] || DEFAULT_SIZE_LABEL;
  return label && !COLOUR_WORD.test(label) ? label : DEFAULT_SIZE_LABEL;
}

// Each option as { name, stock, color, size, images }, "" for a missing part.
export function readOptions(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const structured = variants.some((v) => v && (v.color || v.size));
  const legacyColours =
    !structured &&
    (COLOUR_WORD.test(product?.optionLabel || "") ||
      (!clean(product?.optionLabel) &&
        variants.some((v) => v?.image || v?.images?.length)));
  return variants
    .filter((v) => v && clean(v.name))
    .map((v) => {
      const name = clean(v.name);
      const images = Array.isArray(v.images)
        ? v.images.filter((u) => typeof u === "string" && u)
        : typeof v.image === "string" && v.image
          ? [v.image]
          : [];
      return {
        name,
        stock: stockOf(v.stock),
        color: structured ? clean(v.color) : legacyColours ? name : "",
        size: structured ? clean(v.size) : legacyColours ? "" : name,
        images: unique(images),
      };
    });
}

// ---------------------------------------------------------------- storefront

// What a customer chooses from: the colours (with their photos and whether any
// is left), the sizes, and a way to find the option for a colour and size.
export function optionPicker(product) {
  const options = readOptions(product);
  const colors = [];
  for (const o of options) {
    if (!o.color) continue;
    let c = colors.find((x) => x.name === o.color);
    if (!c) colors.push((c = { name: o.color, images: [], stock: 0 }));
    if (!c.images.length) c.images = o.images;
    c.stock += o.stock;
  }
  const sizes = unique(options.filter((o) => o.size).map((o) => o.size)).map(
    (name) => ({
      name,
      stock: options
        .filter((o) => o.size === name)
        .reduce((sum, o) => sum + o.stock, 0),
    }),
  );
  function find(color, size) {
    return (
      options.find(
        (o) =>
          (!colors.length || o.color === color) &&
          (!sizes.length || o.size === size),
      ) || null
    );
  }
  return {
    colors,
    sizes,
    sizeLabel: sizeLabelOf(product?.optionLabel),
    find,
    // The colour and size of a saved basket line's option name.
    partsOf(name) {
      const o = options.find((x) => x.name === name);
      return o ? { color: o.color, size: o.size } : { color: "", size: "" };
    },
  };
}

// ------------------------------------------------------------------- editor

let counter = 0;
const key = (prefix) => `${prefix}${Date.now().toString(36)}${counter++}`;
const stockKey = (colorKey, sizeKey) => `${colorKey || ""}|${sizeKey || ""}`;

// The editor's view of a product's photos, colours, sizes and stock. Colours
// and sizes carry keys so stock stays with them while they are renamed.
export function editorOptions(product) {
  const options = readOptions(product);
  const colors = [];
  const sizes = [];
  for (const o of options) {
    if (o.color && !colors.some((c) => c.name === o.color))
      colors.push({ key: key("c"), name: o.color, images: o.images });
    if (o.size && !sizes.some((s) => s.name === o.size))
      sizes.push({ key: key("s"), name: o.size });
  }
  const stock = {};
  for (const o of options) {
    const c = colors.find((x) => x.name === o.color);
    const s = sizes.find((x) => x.name === o.size);
    stock[stockKey(c?.key, s?.key)] = String(o.stock);
  }
  const colourPhotos = new Set(colors.flatMap((c) => c.images));
  const all = Array.isArray(product?.images) ? product.images : [];
  // A colour photo that went missing from products.images is dropped.
  for (const c of colors) c.images = c.images.filter((u) => all.includes(u));
  return {
    photos: all.filter((u) => !colourPhotos.has(u)),
    colors,
    sizes,
    sizeLabel: sizeLabelOf(product?.optionLabel),
    stock,
    singleStock:
      options.length || product?.stock === undefined || product?.stock === null
        ? ""
        : String(stockOf(product.stock)),
  };
}

export const newColor = (name = "") => ({ key: key("c"), name, images: [] });
export const newSize = (name = "") => ({ key: key("s"), name });

// The rows of the stock table: one per colour and size pair, or per colour,
// or per size.
export function stockRows({ colors, sizes }) {
  if (colors.length && sizes.length)
    return colors.flatMap((c) =>
      sizes.map((s) => ({ key: stockKey(c.key, s.key), color: c, size: s })),
    );
  if (colors.length)
    return colors.map((c) => ({ key: stockKey(c.key, ""), color: c }));
  return sizes.map((s) => ({ key: stockKey("", s.key), size: s }));
}

// Problems that stop the product being saved, in the order they appear.
export function optionProblems({ colors, sizes, stock, singleStock }) {
  const problems = [];
  const names = (list) => list.map((x) => lower(x.name));
  if (colors.some((c) => !clean(c.name)))
    problems.push("Give every colour a name, or remove the empty one.");
  else if (new Set(names(colors)).size < colors.length)
    problems.push("Two colours have the same name.");
  if (sizes.some((s) => !clean(s.name)))
    problems.push("Give every size a name, or remove the empty one.");
  else if (new Set(names(sizes)).size < sizes.length)
    problems.push("Two sizes have the same name.");
  const count = (colors.length || 1) * (sizes.length || 1);
  if ((colors.length || sizes.length) && count > MAX_OPTIONS)
    problems.push(
      `${colors.length} colours × ${sizes.length} sizes makes ${count} choices; the most is ${MAX_OPTIONS}.`,
    );
  const bad = (value) =>
    clean(value) !== "" &&
    !(Number.isSafeInteger(Number(value)) && Number(value) >= 0);
  const values =
    colors.length || sizes.length
      ? stockRows({ colors, sizes }).map((r) => stock[r.key])
      : [singleStock];
  if (values.some(bad))
    problems.push("Stock must be a whole number, 0 or more.");
  return problems;
}

// The product fields to save: images, variants, optionLabel and stock.
// Empty stock boxes count as 0.
export function productOptionFields({
  photos,
  colors,
  sizes,
  sizeLabel,
  stock,
  singleStock,
}) {
  const colorList = colors.map((c) => ({ ...c, name: clean(c.name) }));
  const sizeList = sizes.map((s) => ({ ...s, name: clean(s.name) }));
  const label = clean(sizeLabel) || DEFAULT_SIZE_LABEL;
  const variants = stockRows({ colors: colorList, sizes: sizeList }).map(
    (row) => {
      const images = row.color?.images || [];
      return {
        name: [row.color?.name, row.size?.name]
          .filter(Boolean)
          .join(OPTION_JOIN),
        ...(row.color && { color: row.color.name }),
        ...(row.size && { size: row.size.name }),
        stock: stockOf(stock[row.key]),
        ...(images.length && { images, image: images[0] }),
      };
    },
  );
  return {
    images: unique([...photos, ...colorList.flatMap((c) => c.images)]),
    variants,
    optionLabel:
      colorList.length && sizeList.length
        ? `${COLOR_LABEL}${OPTION_JOIN}${label}`
        : colorList.length
          ? COLOR_LABEL
          : sizeList.length
            ? label
            : "",
    stock: variants.length
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : stockOf(singleStock),
  };
}
