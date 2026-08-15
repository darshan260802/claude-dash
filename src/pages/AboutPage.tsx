import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EnvelopeSimple, LinkedinLogo, GithubLogo, Globe, ChartLine, ChatsCircle, Broadcast, MagnifyingGlass } from '@phosphor-icons/react'

const DEV = {
  name: 'Darshan Patel',
  email: 'darshanpatel2608ce@gmail.com',
  linkedin: 'https://www.linkedin.com/in/darshan-patel-2608',
  github: 'https://github.com/darshan260802',
  portfolio: 'https://www.darshannpatel.tech/',
  avatar: 'https://avatars.githubusercontent.com/u/91478282?v=4',
}

const LINKS = [
  { label: DEV.email, href: `mailto:${DEV.email}`, icon: EnvelopeSimple },
  { label: 'LinkedIn', href: DEV.linkedin, icon: LinkedinLogo },
  { label: 'GitHub', href: DEV.github, icon: GithubLogo },
  { label: 'Portfolio', href: DEV.portfolio, icon: Globe },
]

const FEATURES = [
  { icon: ChartLine, label: 'Cost & token analytics', desc: 'Exact per-token cost using live LiteLLM pricing, deduped across multi-block turns and forked sessions.' },
  { icon: ChatsCircle, label: 'Full transcripts', desc: 'Every message kind — user, assistant, thinking, tool calls, MCP, sub-agents — filterable and searchable.' },
  { icon: Broadcast, label: 'Live tracking', desc: 'Sessions currently running update in near real time as Claude Code writes to its logs.' },
  { icon: MagnifyingGlass, label: 'Full-text search', desc: 'Search across every transcript in every project, past and present.' },
]

export function AboutPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">About</h1>
        <p className="text-sm text-muted-foreground">The developer behind Claude Dash, and what it does.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar size="lg" className="size-16 sm:size-20">
            <AvatarImage src={DEV.avatar} alt={DEV.name} />
            <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">CD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <div>
              <p className="font-heading text-lg font-semibold">{DEV.name}</p>
              <p className="text-sm text-muted-foreground">Creator & maintainer of Claude Dash</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LINKS.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                  <Badge variant="outline" className="gap-1 hover:bg-muted">
                    <l.icon className="size-3.5" />
                    {l.label}
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">About Claude Dash</CardTitle>
          <CardDescription>A local dashboard for Claude Code usage — sessions, tokens, cost, and full chat transcripts, live-updating as you work.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Claude Dash reads Claude Code's own local session logs directly off disk — nothing is sent anywhere. It indexes every project and session, tails
            live ones as they're written, and prices every token exactly using LiteLLM's pricing data.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex gap-2.5 rounded-md border border-border p-3">
                <f.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
