import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { authExchange } from '@urql/exchange-auth'
import { jwtDecode } from 'jwt-decode'
import { FieldValues, UseFormReturn } from 'react-hook-form'
import {
  AnyVariables,
  cacheExchange,
  Client,
  CombinedError,
  fetchExchange,
  useMutation as useUrqlMutation
} from 'urql'

import {
  clearAuthToken,
  getAuthToken,
  refreshTokenMutation,
  saveAuthToken
} from './auth'

interface ValidationError {
  path: string
  message: string
}

interface ValidationErrors {
  errors: Array<ValidationError>
}

function useMutation<TResult, TVariables extends AnyVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  options?: {
    onCompleted?: (data: TResult) => void
    onError?: (err: CombinedError) => any
    form?: any
  }
) {
  const [mutationResult, executeMutation] = useUrqlMutation<TResult>(document)
  const onFormError = options?.form
    ? makeFormErrorHandler(options.form)
    : undefined

  const fn = async (variables?: TVariables) => {
    let res: TResult | undefined
    try {
      const response = await executeMutation(variables)

      if (response?.error) {
        onFormError && onFormError(response.error)
        options?.onError && options.onError(response.error)
        return
      }

      res = response?.data
    } catch (err: any) {
      options?.onError && options.onError(err)
      return
    }

    res && options?.onCompleted && options.onCompleted(res)
    return res
  }

  return fn
}

function makeFormErrorHandler<T extends FieldValues>(form: UseFormReturn<T>) {
  return (err: CombinedError) => {
    const { graphQLErrors = [] } = err
    for (const error of graphQLErrors) {
      if (error.extensions && error.extensions['validation-errors']) {
        const validationErrors = error.extensions[
          'validation-errors'
        ] as ValidationErrors
        for (const error of validationErrors.errors) {
          form.setError(error.path as any, error)
        }
      } else if (error?.originalError) {
        form.setError('root', error.originalError)
      }
    }
  }
}

const isTokenExpired = (exp: number) => {
  return Date.now() > exp * 1000
}
const client = new Client({
  url: `${process.env.NEXT_PUBLIC_TABBY_SERVER_URL ?? ''}/graphql`,
  requestPolicy: 'cache-and-network',
  exchanges: [
    cacheExchange,
    authExchange(async utils => {
      const authData = getAuthToken()
      let accessToken = authData?.accessToken
      let refreshToken = authData?.refreshToken

      return {
        addAuthToOperation(operation) {
          if (!accessToken) return operation
          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${accessToken}`
          })
        },
        didAuthError(error, _operation) {
          return (
            error.response.status === 401 ||
            error.graphQLErrors.some(
              e => e?.extensions?.code === 'UNAUTHORIZED'
            )
          )
        },
        willAuthError(operation) {
          // Sync tokens on every operation
          const authData = getAuthToken()
          accessToken = authData?.accessToken
          refreshToken = authData?.refreshToken

          if (
            operation.kind === 'mutation' &&
            operation.query.definitions.some(definition => {
              return (
                definition.kind === 'OperationDefinition' &&
                definition.name?.value &&
                ['tokenAuth', 'registerUser'].includes(definition.name.value)
              )
            })
          ) {
            return false
          }

          if (
            refreshToken &&
            operation.kind === 'mutation' &&
            operation.query.definitions.some(definition => {
              return (
                definition.kind === 'OperationDefinition' &&
                definition?.name?.value === 'refreshToken'
              )
            })
          ) {
            return false
          }

          if (accessToken) {
            // Check whether `token` JWT is expired
            try {
              const { exp } = jwtDecode(accessToken)
              return exp ? isTokenExpired(exp) : true
            } catch (e) {
              return true
            }
          } else {
            return true
          }
        },
        async refreshAuth() {
          // if not refreshToken, do logout
          if (refreshToken) {
            const result = await utils.mutate(refreshTokenMutation, {
              refreshToken
            })
            if (result.data?.refreshToken) {
              // Update our local variables and write to our storage
              accessToken = result.data.refreshToken.accessToken
              refreshToken = result.data.refreshToken.refreshToken
              saveAuthToken({
                accessToken,
                refreshToken
              })
            } else {
              clearAuthToken()
            }
          } else {
            // This is where auth has gone wrong and we need to clean up and redirect to a login page
            clearAuthToken()
          }
        }
      }
    }),
    fetchExchange
  ]
})

type QueryVariables<T> = T extends TypedDocumentNode<any, infer U> ? U : never
type QueryResponseData<T> = T extends TypedDocumentNode<infer U, any>
  ? U
  : never

export type {
  ValidationError,
  ValidationErrors,
  QueryVariables,
  QueryResponseData
}
export { useMutation, client }
