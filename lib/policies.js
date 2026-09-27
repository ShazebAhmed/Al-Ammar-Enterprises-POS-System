import { formatMoney } from "./format.js";

// Store policy terms. Change a number here and the policy pages, the checkout
// note and the customer's bill all follow.
export const POLICY = {
  returnDays: 7, // days after delivery to ask for a return or exchange
  damageReportHours: 48, // hours after delivery to report damaged or wrong items
  refundWorkingDays: 5, // working days to send a refund after the return arrives
  dispatchWorkingDays: "1–2",
  deliveryWorkingDays: "2–5",
  remoteDeliveryWorkingDays: "5–7",
};

// Sections for /policies/returns. Each section: { title, points: [string] }.
export function returnPolicy(settings) {
  const contact = contactLine(settings);
  return [
    {
      title: "Changed your mind?",
      points: [
        `You can ask to return or exchange an item within ${POLICY.returnDays} days of receiving it.`,
        "The item must be unused and unwashed, in its original packaging, with any tags, seals and free gifts that came with it.",
        "For change-of-mind returns you send the parcel back at your own cost, and the original delivery charge is not refunded.",
      ],
    },
    {
      title: "Received something damaged, faulty or wrong?",
      points: [
        `Tell us within ${POLICY.damageReportHours} hours of delivery and share clear photos, or an unboxing video if you have one.`,
        "We will send a replacement or give you a full refund, including the delivery charge. You do not pay anything to send it back.",
      ],
    },
    {
      title: "Items we cannot take back",
      points: [
        "Food and grocery items, and beauty or personal-care products once their seal is opened, for hygiene reasons.",
        "Items that have been used, damaged after delivery, or returned without their original packaging.",
        "Anything marked as final sale on the product page.",
      ],
    },
    {
      title: "How to return an item",
      points: [
        `Message us ${contact} with your order number (for example AA-10001), the item and the reason.`,
        "Once we confirm the return, we will share the return address. Please pack the item securely, as it was delivered, and include a copy of your bill.",
        "Use a courier that gives you a tracking number, and keep the receipt until your return is settled.",
      ],
    },
    {
      title: "Refunds and exchanges",
      points: [
        "We check every returned item when it reaches us and let you know the result.",
        `Approved refunds are sent within ${POLICY.refundWorkingDays} working days by bank transfer, JazzCash or Easypaisa, as you prefer. Because orders are paid in cash on delivery, we cannot refund to a card.`,
        "Exchanges are sent out once the returned item has been checked, subject to stock. If the new item costs more, you pay the difference on delivery.",
      ],
    },
    {
      title: "Cancelling an order",
      points: [
        "You can cancel free of charge until your order is dispatched. Just call or message us with your order number.",
        "Once dispatched, the order can be refused at the door or returned under this policy.",
      ],
    },
  ];
}

// Sections for /policies/shipping.
export function shippingPolicy(settings) {
  const fee = formatMoney(settings.shippingFee, settings.currencySymbol);
  const contact = contactLine(settings);
  return [
    {
      title: "Delivery charge",
      points: [
        `Delivery is ${fee} per order, anywhere in Pakistan, however many items you buy. It is shown in your basket before you order.`,
      ],
    },
    {
      title: "Confirming your order",
      points: [
        "After you place an order we call or message you on the number you gave, to confirm the items and your address before we send anything.",
        "If we cannot reach you after two tries, we may cancel the order so the stock is freed for other customers.",
      ],
    },
    {
      title: "When your order is sent",
      points: [
        `Confirmed orders are packed and handed to the courier within ${POLICY.dispatchWorkingDays} working days.`,
        "Orders confirmed on Sundays or public holidays are sent on the next working day.",
        "Once your parcel is on its way, we send you the courier's tracking number by SMS or WhatsApp.",
      ],
    },
    {
      title: "How long delivery takes",
      points: [
        `Most cities: ${POLICY.deliveryWorkingDays} working days after dispatch.`,
        `Smaller towns and remote areas: ${POLICY.remoteDeliveryWorkingDays} working days.`,
        "Weather, strikes, holidays or courier delays can occasionally add a day or two. We will keep you updated if that happens.",
      ],
    },
    {
      title: "Paying for your order",
      points: [
        "Pay the courier in cash when your parcel arrives. Please keep the exact amount ready.",
        "Check the outer packaging when it arrives. If it looks opened or badly damaged, record it on your phone before opening, or refuse the parcel and call us.",
      ],
    },
    {
      title: "Questions about a delivery",
      points: [
        `Message us ${contact} with your order number and we will check with the courier for you.`,
      ],
    },
  ];
}

// One short paragraph for the bill.
export function billPolicySummary() {
  return `Returns & exchanges: unused items in original packaging within ${POLICY.returnDays} days of delivery. Damaged or wrong item? Tell us within ${POLICY.damageReportHours} hours for a free replacement or full refund. Food and opened beauty items cannot be returned.`;
}

function contactLine(settings) {
  const ways = [];
  if (settings.whatsapp) ways.push(`on WhatsApp at ${settings.whatsapp}`);
  if (settings.contactPhone && settings.contactPhone !== settings.whatsapp)
    ways.push(`by phone at ${settings.contactPhone}`);
  return ways.length ? ways.join(" or ") : "through the contact details below";
}
