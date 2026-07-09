import { Card } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export function SurfaceCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn('island-shell', className)} {...props} />
}

export function FeatureCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card className={cn('island-shell feature-card', className)} {...props} />
  )
}
