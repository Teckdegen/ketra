import Link from "next/link";

export default function Receive() {
  return (
    <div className="max-w-lg">
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Receive</h1>
      <p className="mt-2 text-[14px] leading-6 text-[#8a8a8a]">
        ETH sent to the account address shows up in the portfolio. There is no address until the account is created.
      </p>
      <div className="mt-6 glass rounded-[28px] px-6 py-16 text-center">
        <p className="text-[15px] text-[#8a8a8a]">No address yet</p>
        <Link href="/create" className="mt-6 inline-block rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
          Create a new wallet
        </Link>
      </div>
    </div>
  );
}
