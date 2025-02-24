import { ApiClient } from '@B-S-F/yaku-client-lib'
import {
  Environment,
  loadCurrentEnvironment,
  updateEnvironment,
} from './commands/environment.js'
import { refreshOAuth } from './oauth.js'
import { consoleWarnYellow, failWithError } from './common.js'
import { ProxyAgent, Agent, Dispatcher } from 'undici'

export async function connect(): Promise<{
  client: ApiClient
  namespace: number | undefined
}> {
  let currentEnv: Environment = loadCurrentEnvironment()
  // re-authenticate if it is an oauth environment
  const updatedEnv: Environment | undefined = await refreshEnvironment(
    currentEnv
  )
  if (updatedEnv) {
    currentEnv = updatedEnv
  }
  // create API client
  const namespace = currentEnv.namespace
  const client = createApiClient(currentEnv)

  return { client, namespace }
}

export async function refreshEnvironment(
  env: Environment
): Promise<Environment> {
  // re-authenticate if it is an oauth environment
  if (env.refreshToken) {
    consoleWarnYellow(`Refreshing authentication token for '${env.name}'`)
    try {
      const updatedEnv = await refreshOAuth(env)
      updateEnvironment(env.name, updatedEnv)
      return updatedEnv
    } catch (err) {
      failWithError(
        `Error refreshing token or re-login failed. Please login again with 'yaku login --env ${env.name}'`
      )
    }
  } else {
    return env
  }
}

export function createApiClient(env: Environment): ApiClient {
  let agent: Dispatcher = new Dispatcher()

  const proxyAgentOptions = {
    token: `Basic ${Buffer.from(
      `${process.env.USERNAME}:${process.env.PASSWORD}`
    ).toString('base64')}`,
  }

  const proxyEnvVars = [
    'https_proxy',
    'HTTPS_PROXY',
    'http_proxy',
    'HTTP_PROXY',
  ]

  let usingProxy = false

  for (const proxyEnvvar of proxyEnvVars) {
    const proxyUri = process.env[proxyEnvvar]
    if (proxyUri) {
      agent = new ProxyAgent({
        ...proxyAgentOptions,
        uri: proxyUri,
      })
      usingProxy = true
      break
    }
  }

  if (!usingProxy) {
    agent = new Agent()
  }
  return new ApiClient({
    baseUrl: env.url!,
    token: env.accessToken!,
    agent: agent,
  })
}
