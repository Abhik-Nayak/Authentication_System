export default function OTPInput({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder="Enter 6-digit OTP"
      className="w-full text-center tracking-widest text-lg bg-white/5 border border-white/10 text-white rounded-lg py-2 focus:border-emerald-400 outline-none"
    />
  );
}
