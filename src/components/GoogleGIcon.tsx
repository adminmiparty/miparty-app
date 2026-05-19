import Image from 'next/image'

type GoogleGIconProps = {
  className?: string
  size?: number
}

export default function GoogleGIcon({ className = 'shrink-0', size = 20 }: GoogleGIconProps) {
  return (
    <Image
      src="/icons/google-g.png"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  )
}
