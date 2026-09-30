import test from "node:test";
import assert from "node:assert/strict";
import {
  editorOptions,
  newColor,
  newSize,
  optionPicker,
  optionProblems,
  productOptionFields,
  readOptions,
  sizeLabelOf,
  stockRows,
} from "../lib/productOptions.js";
import { productFromRow } from "../lib/format.js";

const url = (name) => `https://x.supabase.co/storage/v1/${name}.jpg`;

// The editor state for a product in two colours and three sizes.
function shirtEditor() {
  const black = {
    ...newColor("Black"),
    images: [url("black1"), url("black2")],
  };
  const brown = { ...newColor("Brown"), images: [url("brown1")] };
  const sizes = ["S", "M", "L"].map((n) => newSize(n));
  const stock = {};
  stockRows({ colors: [black, brown], sizes }).forEach((row, i) => {
    stock[row.key] = String(i); // 0..5
  });
  return {
    photos: [url("main1"), url("main2")],
    colors: [black, brown],
    sizes,
    sizeLabel: "Size",
    stock,
    singleStock: "",
  };
}

test("colours and sizes become one option per pair, with each colour's photos", () => {
  const fields = productOptionFields(shirtEditor());
  assert.equal(fields.optionLabel, "Colour / Size");
  assert.deepEqual(
    fields.variants.map((v) => [v.name, v.color, v.size, v.stock]),
    [
      ["Black / S", "Black", "S", 0],
      ["Black / M", "Black", "M", 1],
      ["Black / L", "Black", "L", 2],
      ["Brown / S", "Brown", "S", 3],
      ["Brown / M", "Brown", "M", 4],
      ["Brown / L", "Brown", "L", 5],
    ],
  );
  assert.deepEqual(fields.variants[0].images, [url("black1"), url("black2")]);
  assert.equal(fields.variants[0].image, url("black1"));
  assert.deepEqual(fields.variants[3].images, [url("brown1")]);
  // Main photos first (the first is the cover), then each colour's photos.
  assert.deepEqual(fields.images, [
    url("main1"),
    url("main2"),
    url("black1"),
    url("black2"),
    url("brown1"),
  ]);
  assert.equal(fields.stock, 15);
});

test("a saved product opens in the editor exactly as it was entered", () => {
  const before = shirtEditor();
  const fields = productOptionFields(before);
  // As the database returns it, read back through productFromRow.
  const product = productFromRow({
    id: "p",
    price: 900,
    stock: fields.stock,
    images: fields.images,
    option_label: fields.optionLabel,
    variants: fields.variants,
  });
  const after = editorOptions(product);
  assert.deepEqual(after.photos, before.photos);
  assert.deepEqual(
    after.colors.map((c) => [c.name, c.images]),
    before.colors.map((c) => [c.name, c.images]),
  );
  assert.deepEqual(
    after.sizes.map((s) => s.name),
    ["S", "M", "L"],
  );
  assert.equal(after.sizeLabel, "Size");
  assert.deepEqual(
    stockRows(after).map((r) => after.stock[r.key]),
    ["0", "1", "2", "3", "4", "5"],
  );
  assert.deepEqual(productOptionFields(after), fields);
});

test("colours only, sizes only, and no options", () => {
  const black = { ...newColor("Black"), images: [url("b")] };
  const onlyColours = productOptionFields({
    photos: [],
    colors: [black, newColor("Tan")],
    sizes: [],
    sizeLabel: "Size",
    stock: { [`${black.key}|`]: "4" },
    singleStock: "9",
  });
  assert.equal(onlyColours.optionLabel, "Colour");
  assert.deepEqual(
    onlyColours.variants.map((v) => [v.name, v.color, v.size, v.stock]),
    [
      ["Black", "Black", undefined, 4],
      ["Tan", "Tan", undefined, 0],
    ],
  );
  assert.equal(onlyColours.stock, 4);
  assert.equal(onlyColours.variants[1].images, undefined);

  const pack = newSize("Pack of 3");
  const onlySizes = productOptionFields({
    photos: [url("m")],
    colors: [],
    sizes: [pack],
    sizeLabel: " Pack ",
    stock: { [`|${pack.key}`]: "2" },
    singleStock: "",
  });
  assert.equal(onlySizes.optionLabel, "Pack");
  assert.deepEqual(onlySizes.variants, [
    { name: "Pack of 3", size: "Pack of 3", stock: 2 },
  ]);

  const plain = productOptionFields({
    photos: [url("m")],
    colors: [],
    sizes: [],
    sizeLabel: "Size",
    stock: {},
    singleStock: "7",
  });
  assert.deepEqual(plain, {
    images: [url("m")],
    variants: [],
    optionLabel: "",
    stock: 7,
  });
});

test("products saved before colours and sizes existed are read correctly", () => {
  // Like the live wallets: options called "Color", one photo on Black.
  const wallet = productFromRow({
    id: "w",
    price: 2450,
    stock: 12,
    images: [url("1"), url("2"), url("3")],
    option_label: "Color",
    variants: [
      { name: "Black", stock: 7, image: url("1") },
      { name: "Camel Brown", stock: 5 },
    ],
  });
  const editor = editorOptions(wallet);
  assert.deepEqual(editor.photos, [url("2"), url("3")]);
  assert.deepEqual(
    editor.colors.map((c) => [c.name, c.images]),
    [
      ["Black", [url("1")]],
      ["Camel Brown", []],
    ],
  );
  assert.equal(editor.sizes.length, 0);
  // Saving keeps the option names, so baskets and orders still match.
  const fields = productOptionFields(editor);
  assert.deepEqual(
    fields.variants.map((v) => [v.name, v.stock]),
    [
      ["Black", 7],
      ["Camel Brown", 5],
    ],
  );
  const picker = optionPicker(wallet);
  assert.deepEqual(
    picker.colors.map((c) => [c.name, c.images, c.stock]),
    [
      ["Black", [url("1")], 7],
      ["Camel Brown", [], 5],
    ],
  );
  assert.equal(picker.find("Camel Brown", "").name, "Camel Brown");

  // Options called "Size" stay sizes, even if one had a photo.
  const shirt = {
    optionLabel: "Size",
    variants: [{ name: "M", stock: 2, image: url("m") }],
  };
  assert.deepEqual(
    readOptions(shirt).map((o) => [o.color, o.size]),
    [["", "M"]],
  );
  assert.equal(
    editorOptions({ ...shirt, images: [url("m")] }).colors.length,
    0,
  );
  assert.equal(editorOptions({ stock: 4, variants: [] }).singleStock, "4");
});

test("the storefront picks a colour, then a size that has stock in it", () => {
  const fields = productOptionFields(shirtEditor());
  const product = productFromRow({
    id: "p",
    price: 900,
    images: fields.images,
    option_label: fields.optionLabel,
    variants: fields.variants,
    stock: fields.stock,
  });
  const picker = optionPicker(product);
  assert.deepEqual(
    picker.colors.map((c) => [c.name, c.stock, c.images.length]),
    [
      ["Black", 3, 2],
      ["Brown", 12, 1],
    ],
  );
  assert.deepEqual(
    picker.sizes.map((s) => [s.name, s.stock]),
    [
      ["S", 3],
      ["M", 5],
      ["L", 7],
    ],
  );
  assert.equal(picker.sizeLabel, "Size");
  assert.equal(picker.find("Black", "S").stock, 0);
  assert.equal(picker.find("Brown", "L").name, "Brown / L");
  assert.equal(picker.find("Blue", "L"), null);
  assert.deepEqual(picker.partsOf("Brown / M"), { color: "Brown", size: "M" });
});

test("problems that stop saving", () => {
  const base = { colors: [], sizes: [], stock: {}, singleStock: "" };
  assert.deepEqual(optionProblems(base), []);
  assert.deepEqual(optionProblems({ ...base, singleStock: "2.5" }), [
    "Stock must be a whole number, 0 or more.",
  ]);
  assert.deepEqual(
    optionProblems({
      ...base,
      colors: [newColor("Black"), newColor(" black ")],
    }),
    ["Two colours have the same name."],
  );
  assert.deepEqual(optionProblems({ ...base, sizes: [newSize("")] }), [
    "Give every size a name, or remove the empty one.",
  ]);
  const colors = Array.from({ length: 8 }, (_, i) => newColor(`C${i}`));
  const sizes = Array.from({ length: 7 }, (_, i) => newSize(`S${i}`));
  assert.deepEqual(optionProblems({ ...base, colors, sizes }), [
    "8 colours × 7 sizes makes 56 choices; the most is 50.",
  ]);
  const one = newSize("M");
  assert.deepEqual(
    optionProblems({ ...base, sizes: [one], stock: { [`|${one.key}`]: "-1" } }),
    ["Stock must be a whole number, 0 or more."],
  );
});

test("what the sizes are called", () => {
  assert.equal(sizeLabelOf("Colour / Length"), "Length");
  assert.equal(sizeLabelOf("Pack"), "Pack");
  assert.equal(sizeLabelOf("Colour"), "Size");
  assert.equal(sizeLabelOf(""), "Size");
});

test("an option's photos are kept only while they are among the product's photos", () => {
  const product = productFromRow({
    id: "p",
    price: 1,
    images: [url("a")],
    variants: [
      {
        name: "Black / M",
        color: "Black",
        size: "M",
        stock: 1,
        images: [url("a"), url("gone")],
        image: url("a"),
      },
    ],
  });
  assert.deepEqual(product.variants, [
    {
      name: "Black / M",
      stock: 1,
      color: "Black",
      size: "M",
      images: [url("a")],
      image: url("a"),
    },
  ]);
});
