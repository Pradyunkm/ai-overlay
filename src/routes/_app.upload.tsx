import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/upload')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/upload"!</div>
}
