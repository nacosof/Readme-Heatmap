import Image from "next/image";

const PROFILE_URL =
  process.env.NEXT_PUBLIC_PROFILE_URL ?? "https://github.com/nacosof";

export function BuiltBy() {
  return (
    <footer className="built-by">
      <p className="built-by__label">BUILT BY</p>
      <a
        href={PROFILE_URL}
        className="built-by__profile"
        target="_blank"
        rel="noreferrer"
      >
        <Image
          src="/profile.png"
          alt="Nacsof"
          width={56}
          height={56}
          className="built-by__avatar"
          priority
        />
        <span className="built-by__name">nacosof</span>
      </a>
    </footer>
  );
}
