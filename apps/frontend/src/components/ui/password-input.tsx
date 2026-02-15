import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<typeof Input>, 'type'>>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-9', className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0 h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? t('accessibility.hidePassword') : t('accessibility.showPassword')}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
