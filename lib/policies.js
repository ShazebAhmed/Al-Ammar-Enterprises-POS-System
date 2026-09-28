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
  orderRecordYears: 5, // how long order records are kept (privacy policy)
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

// Sections for /policies/privacy.
export function privacyPolicy(settings) {
  const contact = contactLine(settings);
  const store = settings.storeName || "Al Ammar Store";
  return [
    {
      title: "Who we are",
      points: [
        `${store} is an online shop in Pakistan that delivers orders with cash on delivery. This policy covers our website and our Android app.`,
      ],
    },
    {
      title: "What we collect",
      points: [
        "When you order: your name, phone number, delivery address and city, any note you add, and what you ordered.",
        "When you create an account: your email address, name, phone number and a password (stored only in encrypted form by our sign-in provider). Your basket is saved to your account.",
        "When you write a review: the name you enter, your rating and your comment.",
        "We do not collect card details, your location, contacts or photos, and we do not use advertising or tracking cookies.",
      ],
    },
    {
      title: "How we use it",
      points: [
        "To confirm, pack and deliver your order, and to call or message you about it.",
        "To show your order history and keep your basket when you sign in.",
        "To handle returns, refunds and complaints, and to prevent fake or fraudulent orders.",
        "We never sell your information or share it for advertising.",
      ],
    },
    {
      title: "Who else handles it",
      points: [
        "Supabase stores our database and runs sign-in. Vercel hosts the website. Both only process data on our behalf.",
        "The courier receives your name, phone number and address to deliver your parcel.",
        "If you choose to order or message us on WhatsApp, that conversation is handled by WhatsApp under its own policy.",
      ],
    },
    {
      title: "On your phone",
      points: [
        "The website and app keep your sign-in and your basket in your browser's storage so you stay signed in. Signing out or clearing the app's data removes them.",
      ],
    },
    {
      title: "How long we keep it",
      points: [
        "Your account stays until you delete it.",
        `Order records (items, amounts and the delivery details) are kept for up to ${POLICY.orderRecordYears} years for accounting, returns and fraud prevention, even if you delete your account, and are then removed.`,
      ],
    },
    {
      title: "Your choices",
      points: [
        "You can see your orders and details on your account page, and ask us to correct them.",
        "You can delete your account at any time. The Delete your account page explains how.",
        `For any privacy question, message us ${contact}.`,
      ],
    },
    {
      title: "Changes",
      points: [
        "If we change this policy we will update this page. Using the website or app after a change means you accept the updated policy.",
      ],
    },
  ];
}

// Sections for /policies/delete-account (Google Play requires a web page for this).
export function deleteAccountPolicy(settings) {
  const contact = contactLine(settings);
  return [
    {
      title: "Delete it yourself",
      points: [
        "Open the website or the Al Ammar Store app and sign in.",
        "Go to Your account and choose Delete my account at the bottom of the page.",
        "Confirm. You are signed out straight away and the account cannot be recovered.",
      ],
    },
    {
      title: "Can't sign in?",
      points: [
        `Message us ${contact} from the phone number on your account, with the email address you signed up with, and ask us to delete it. We will do it within 7 days.`,
      ],
    },
    {
      title: "What is deleted",
      points: [
        "Your sign-in (email and password), the name and phone number on your profile, and your saved basket.",
      ],
    },
    {
      title: "What we keep",
      points: [
        `Past orders are kept for up to ${POLICY.orderRecordYears} years for accounting, returns and fraud prevention, but are no longer linked to an account. Reviews you posted stay on the products, shown with the name you entered.`,
      ],
    },
  ];
}

// Sections for /policies/terms.
export function termsPolicy(settings) {
  const contact = contactLine(settings);
  const store = settings.storeName || "Al Ammar Store";
  return [
    {
      title: "About these terms",
      points: [
        `These terms apply when you use the ${store} website or Android app, or place an order with us. By ordering you accept them, together with our shipping, returns and privacy policies.`,
        "We sell to customers in Pakistan only. You must be 18 or older, or order with a parent's or guardian's permission.",
      ],
    },
    {
      title: "Products and prices",
      points: [
        "Prices are in Pakistani rupees and include any applicable taxes. The delivery charge is added at checkout.",
        "We try to show every product, colour and size accurately, but screens differ and small differences from the photos are possible.",
        "If a price or description on the site is clearly wrong, we will tell you before dispatch and you can confirm at the correct price or cancel at no cost.",
      ],
    },
    {
      title: "Your order",
      points: [
        "Placing an order is an offer to buy. The contract is made when we confirm the order with you by phone or message.",
        "We may refuse or cancel an order, for example if an item is out of stock, the address cannot be served, or the order looks fraudulent. If so, we will tell you and you pay nothing.",
        "Discount codes have their own conditions, cannot be exchanged for cash and are applied to the order before delivery.",
      ],
    },
    {
      title: "Payment and delivery",
      points: [
        "Orders are paid in cash to the courier on delivery. If confirmed orders are refused at the door without a valid reason, we may stop accepting cash-on-delivery orders from that number.",
        "Delivery times are estimates. Ownership and risk of the goods pass to you when you receive and pay for them.",
      ],
    },
    {
      title: "Your account and reviews",
      points: [
        "Keep your password private. You are responsible for orders placed from your account.",
        "Reviews must be honest and about the product. We may remove reviews that are abusive, misleading, advertising or about something else.",
      ],
    },
    {
      title: "Our responsibility",
      points: [
        "If something goes wrong with an order, we will repair, replace or refund the item as set out in our returns policy. This does not affect your rights under Pakistani consumer law.",
        "We are not responsible for delays caused by events outside our control, such as strikes, floods or courier network problems, but we will keep you informed.",
      ],
    },
    {
      title: "Changes and contact",
      points: [
        "We may update these terms. The version on this page when you place an order applies to that order.",
        "These terms are governed by the laws of Pakistan.",
        `For any question about these terms, message us ${contact}.`,
      ],
    },
  ];
}

// Questions and answers for /faq, built from the same policy terms.
export function faq(settings) {
  const fee = formatMoney(settings.shippingFee, settings.currencySymbol);
  const contact = contactLine(settings);
  return [
    {
      q: "How do I pay?",
      a: "Cash on delivery. You pay the courier when your parcel arrives; no card or online payment is needed.",
    },
    {
      q: "How much is delivery?",
      a: `Delivery is ${fee} per order anywhere in Pakistan, however many items you buy.`,
    },
    {
      q: "How long does delivery take?",
      a: `We send confirmed orders within ${POLICY.dispatchWorkingDays} working days. Most cities receive them ${POLICY.deliveryWorkingDays} working days later; smaller towns can take ${POLICY.remoteDeliveryWorkingDays} working days.`,
    },
    {
      q: "Do I need an account to order?",
      a: "No. You can order as a guest with your name, phone number and address. An account keeps your order history and your basket.",
    },
    {
      q: "How do I track my order?",
      a: "Open Track your order and enter your order number (for example AA-10001) with the phone number you ordered with. You can also turn on notifications for status updates.",
    },
    {
      q: "Can I cancel my order?",
      a: `Yes, free of charge until it is dispatched. Message us ${contact} with your order number.`,
    },
    {
      q: "Can I return or exchange an item?",
      a: `Yes, unused items in their original packaging within ${POLICY.returnDays} days of delivery. Damaged or wrong items must be reported within ${POLICY.damageReportHours} hours for a free replacement or full refund.`,
    },
    {
      q: "How are refunds paid?",
      a: `By bank transfer, JazzCash or Easypaisa, within ${POLICY.refundWorkingDays} working days after the returned item reaches us.`,
    },
    {
      q: "How do I use a discount code?",
      a: "Enter the code in the Discount code box at checkout and tap Apply. The discount is shown before you place the order.",
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
