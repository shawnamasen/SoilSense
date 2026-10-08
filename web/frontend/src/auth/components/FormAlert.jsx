import { AlertCircle, CheckCircle2 } from 'lucide-react';
export default function FormAlert({
  type = 'error',
  children
}) {
  if (!children) return null;
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const className = isSuccess ? 'border-lime-200 bg-lime-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700';
  return <div role="alert" className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>;
}
