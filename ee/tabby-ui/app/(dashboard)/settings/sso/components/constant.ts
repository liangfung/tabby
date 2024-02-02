import { OAuthProvider } from '@/lib/gql/generates/graphql'

export const PROVIDER_METAS: Array<{
  name: string
  enum: OAuthProvider
  meta: {
    domain: string
    displayName: string
  }
}> = [
  {
    name: 'github',
    enum: OAuthProvider.Github,
    meta: {
      domain: 'github.com',
      displayName: 'Github'
    }
  },
  {
    name: 'google',
    enum: OAuthProvider.Google,
    meta: {
      domain: 'google.com',
      displayName: 'Google'
    }
  }
]
