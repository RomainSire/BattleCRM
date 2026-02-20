import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'
import { Moon, Sun, SunMoon } from 'lucide-react'

const icons = {
  system: SunMoon,
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
