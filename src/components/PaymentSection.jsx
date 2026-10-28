import React from 'react';

export default function PaymentSection({ payment, orderTotal }) {
  const handlePayNow = () => {
    if (!payment?.pay_url) return;

    // Inside Telegram WebApp, use the native openLink method so it opens the bank app / browser smoothly
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(payment.pay_url);
    } else {
      window.open(payment.pay_url, '_blank', 'noopener,noreferrer');
    }
  };

  // If there is neither a QR image nor a payment link, don't show the section
  if (!payment?.qr_image_url && !payment?.pay_url) {
    return null;
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4 my-4">
      <h3 className="font-bold text-gray-800 text-base">Payment Details</h3>

      {orderTotal && (
        <p className="text-sm text-gray-500">
          Total to Pay: <span className="font-bold text-emerald-600">${orderTotal}</span>
        </p>
      )}

      {/* QR Code Display */}
      {payment?.qr_image_url && (
        <div className="flex flex-col items-center">
          <img
            src={payment.qr_image_url}
            alt="Scan to Pay"
            className="w-48 h-48 object-contain rounded-xl border border-gray-200 shadow-xs"
          />
          <p className="text-xs text-gray-400 mt-2">Scan QR with your mobile banking app</p>
        </div>
      )}

      {/* Pay Now Button */}
      {payment?.pay_url && (
        <button
          type="button"
          onClick={handlePayNow}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2 text-sm"
        >
          <span>💳</span>
          <span>Pay Now</span>
        </button>
      )}
    </div>
  );
}