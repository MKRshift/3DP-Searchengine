const TOKEN_PATTERN = /(?:^|\s)(source|type|format|license|price):([^\s]+)/gi;

function clean(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

export function parseAdvancedQuery(rawQuery = "") {
  const source = [];
  const parsed = {
    source,
    type: null,
    format: null,
    license: null,
    price: null,
  };

  const text = (rawQuery ?? "").toString();
  const stripped = text.replace(TOKEN_PATTERN, (_, key, value) => {
    const k = clean(key);
    const v = clean(value);
    if (k === "source") parsed.source.push(v);
    else parsed[k] = v;
    return " ";
  });

  const queryText = stripped.replace(/\s+/g, " ").trim();

  return {
    queryText,
    parsed,
    chips: [
      ...parsed.source.map((item) => ({ key: "source", value: item })),
      ...["type", "format", "license", "price"]
        .filter((key) => parsed[key])
        .map((key) => ({ key, value: parsed[key] })),
    ],
  };
}
