type NumericLike = number | string | null | undefined;

type PricingLineInput = {
  precio?: NumericLike;
  cantidad?: NumericLike;
  descuento?: NumericLike;
  alto?: NumericLike;
  ancho?: NumericLike;
  largo?: NumericLike;
  precioPorPie?: NumericLike;
  unidadMedida?: string | null;
  unidad?: string | null;
  precioIncluyeCantidad?: boolean | null;
  subcategoria?: string | null;
  subCategoria?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  categoria?: string | null;
  [key: string]: unknown;
};

type PricingTotals = {
  subtotal: number;
  descuentoTotal: number;
  total: number;
};

function toNumber(value: NumericLike): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeQuantity(value: NumericLike): number {
  return Math.max(1, toNumber(value) || 1);
}

function normalizeUnit(unit?: string | null): string {
  return String(unit || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getMeasurement(item: PricingLineInput): { value: number; unit: string } | null {
  const unit = normalizeUnit(item.unidadMedida || item.unidad);
  const ancho = toNumber(item.ancho);
  const alto = toNumber(item.alto);
  const largo = toNumber(item.largo);
  const cantidad = normalizeQuantity(item.cantidad);

  if (!unit) return null;

  if ((unit === "m2" || unit === "m²") && ancho > 0 && alto > 0) {
    return { value: ancho * alto * cantidad, unit: "m²" };
  }

  if ((unit === "m3" || unit === "m³") && ancho > 0 && alto > 0 && largo > 0) {
    return { value: ancho * alto * largo * cantidad, unit: "m³" };
  }

  if ((unit === "ml" || unit === "m.l." || unit === "metrolineal") && largo > 0) {
    return { value: largo * cantidad, unit: "ml" };
  }

  return null;
}

function getLineBase(item: PricingLineInput): number {
  const precio = Math.max(0, toNumber(item.precio));
  const cantidad = normalizeQuantity(item.cantidad);
  const precioPorPie = Math.max(0, toNumber(item.precioPorPie));
  const measurement = getMeasurement(item);

  if (precioPorPie > 0 && measurement) {
    return measurement.value * precioPorPie;
  }

  if (item.precioIncluyeCantidad) {
    return precio;
  }

  return precio * cantidad;
}

function applyDiscount(base: number, descuento: NumericLike): { total: number; amount: number } {
  const discountValue = Math.max(0, toNumber(descuento));
  if (discountValue <= 0) {
    return { total: base, amount: 0 };
  }

  const amount = discountValue > 1 ? Math.min(base, discountValue) : base * discountValue;
  return {
    total: Math.max(0, base - amount),
    amount,
  };
}

export function computeLineBase(item: PricingLineInput): number {
  return getLineBase(item);
}

export function computeLineSubtotal(item: PricingLineInput): number {
  const base = getLineBase(item);
  return applyDiscount(base, item.descuento).total;
}

export function computeTotals(
  items: PricingLineInput[] | undefined | null
): PricingTotals {
  const list = Array.isArray(items) ? items : [];
  const initialTotals: PricingTotals = {
    subtotal: 0,
    descuentoTotal: 0,
    total: 0,
  };

  return list.reduce<PricingTotals>((acc, item) => {
      const base = getLineBase(item);
      const discount = applyDiscount(base, item.descuento);

      acc.subtotal += base;
      acc.descuentoTotal += discount.amount;
      acc.total += discount.total;
      return acc;
    }, initialTotals);
}

export function computeQuantityDisplay(item: PricingLineInput): {
  value: number;
  unit: string;
} | null {
  const measurement = getMeasurement(item);
  if (measurement && measurement.value > 0) {
    return measurement;
  }

  const cantidad = normalizeQuantity(item.cantidad);
  const unit = String(item.unidadMedida || item.unidad || "").trim();

  return unit ? { value: cantidad, unit } : { value: cantidad, unit: "u" };
}
