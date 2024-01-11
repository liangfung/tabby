'use client'

import React, { PropsWithChildren, useState } from 'react'
import { has } from 'lodash-es'
import useSWRImmutable from 'swr/immutable'

import { useAuthenticatedApi } from '@/lib/tabby/auth'
import fetcher, { tokenTextFetcher as textFetcher } from '@/lib/tabby/fetcher'
import { cn } from '@/lib/utils'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'

import { RepositoriesFileTree, TFileTreeNode } from './file-tree'
import { SourceCodeEditor } from './source-code-editor'

type TCodeMap = Record<string, string>
type TFileMetaMap = Record<string, TFileMeta>
type TCodeTag = {
  range: TRange
  name_range: TRange
  line_range: TRange
  is_definition: boolean
  syntax_type_name: string
}
type TRange = { start: number; end: number }
type TFileMeta = {
  git_url: string
  filepath: string
  language: string
  max_line_length: number
  avg_line_length: number
  alphanum_fraction: number
  tags: TCodeTag[]
}

type SourceCodeBrowserContextValue = {
  codeMap: Record<string, string>
  setCodeMap: React.Dispatch<React.SetStateAction<TCodeMap>>
  fileMetaMap: TFileMetaMap
  setFileMetaMap: React.Dispatch<React.SetStateAction<TFileMetaMap>>
  activePath: string | undefined
  setActivePath: React.Dispatch<React.SetStateAction<string | undefined>>
}

type SourceCodeBrowserProviderProps = {}

const SourceCodeBrowserContext =
  React.createContext<SourceCodeBrowserContextValue>(
    {} as SourceCodeBrowserContextValue
  )

const SourceCodeBrowserContextProvider: React.FC<
  PropsWithChildren<SourceCodeBrowserProviderProps>
> = ({ children }) => {
  const [activePath, setActivePath] = React.useState<string>()
  const [codeMap, setCodeMap] = useState<TCodeMap>({})
  const [fileMetaMap, setFileMetaMap] = useState<TFileMetaMap>({})

  return (
    <SourceCodeBrowserContext.Provider
      value={{
        codeMap,
        setCodeMap,
        fileMetaMap,
        setFileMetaMap,
        activePath,
        setActivePath
      }}
    >
      {children}
    </SourceCodeBrowserContext.Provider>
  )
}

interface SourceCodeBrowserProps {
  className?: string
}

const SourceCodeBrowserRenderer: React.FC<SourceCodeBrowserProps> = ({
  className
}) => {
  const repositoryName = 'https_github.com_TabbyML_tabby.git'
  const [fileResolver, setFileResolver] = React.useState<string>()
  const { activePath, setActivePath, codeMap, setCodeMap, setFileMetaMap } =
    React.useContext(SourceCodeBrowserContext)
  const { data: fileContent } = useSWRImmutable(
    useAuthenticatedApi(
      fileResolver
        ? `/repositories/${repositoryName}/resolve/${fileResolver}`
        : null
    ),
    textFetcher
  )

  const { data: fileMeta } = useSWRImmutable(
    useAuthenticatedApi(
      fileContent && fileResolver
        ? `/repositories/${repositoryName}/meta/${fileResolver}`
        : null
    ),
    fetcher
  )

  const onSelectTreeNode = (treeNode: TFileTreeNode) => {
    const path = treeNode.file.basename
    const isFile = treeNode.file.kind === 'file'
    if (isFile) {
      setActivePath(path)
      if (!has(codeMap, path)) {
        setFileResolver(path)
      }
    }
  }

  React.useEffect(() => {
    if (fileContent && activePath) {
      setCodeMap(map => ({
        ...map,
        [activePath]: fileContent
      }))
    }
  }, [fileContent])

  React.useEffect(() => {
    if (fileMeta && activePath) {
      setFileMetaMap(map => ({
        ...map,
        [activePath]: fileMeta
      }))
    }
  }, [fileMeta])

  return (
    <ResizablePanelGroup direction="horizontal" className={cn(className)}>
      <ResizablePanel defaultSize={15} minSize={15}>
        <RepositoriesFileTree
          className="h-full overflow-y-auto"
          onSelectTreeNode={onSelectTreeNode}
          activePath={activePath}
        />
      </ResizablePanel>
      <ResizableHandle className="hover:bg-primary active:bg-primary w-[2px]" />
      <ResizablePanel defaultSize={85} minSize={30}>
        <SourceCodeEditor
          className={`flex h-full ${activePath ? 'block' : 'hidden'}`}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

const SourceCodeBrowser: React.FC<SourceCodeBrowserProps> = props => {
  return (
    <SourceCodeBrowserContextProvider>
      <SourceCodeBrowserRenderer {...props} />
    </SourceCodeBrowserContextProvider>
  )
}

export {
  SourceCodeBrowserContext,
  SourceCodeBrowser,
  type TCodeTag,
  type TRange,
  type TFileMeta
}