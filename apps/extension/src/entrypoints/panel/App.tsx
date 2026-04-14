import { useTranslation } from 'react-i18next'
import '../../assets/tailwind.css'

export default function App() {
  const { t } = useTranslation()

  return (
    <div className="w-105 p-4">
      <h1 className="text-lg font-bold text-gray-900">{t('panel.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('panel.description')}</p>
    </div>
  )
}
