import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

const icons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

export function ThemeSwitcher() {
  const { theme, cycle } = useTheme()
  const Icon = icons[theme]

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label={theme}>
      <Icon className="size-4" />
    </Button>
  )
}
