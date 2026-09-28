"use client";
import { useRouter } from "next/navigation";
import { saveBuyNow } from "@/lib/cart";

// Goes straight to the delivery details with just this item; the basket is untouched.
export default function BuyNowButton({
  productId,
  variant = "",
  qty = 1,
  disabled = false,
  className = "add-button buy-now",
  children = "Buy now",
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        saveBuyNow({ productId: String(productId), variant, qty });
        router.push("/checkout?buy=1");
      }}
    >
      {children}
    </button>
  );
}
