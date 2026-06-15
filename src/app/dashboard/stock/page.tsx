import { redirect } from "next/navigation";

export default function StockRedirectPage() {
  redirect("/dashboard/product-delivery");
}
