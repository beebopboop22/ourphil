import { createContext, useContext, useMemo, useRef } from 'react'

const MANAGED_KEY_ATTR = 'data-head-key'

const HeadContext = createContext(null)

const createRecord = () => ({
  element: null,
  entries: new Map(),
  order: [],
})

export const HeadProvider = ({ children }) => {
  const elementsRef = useRef(new Map())
  const titleStateRef = useRef({
    defaultTitle: typeof document !== 'undefined' ? document.title : '',
    order: [],
    values: new Map(),
  })

  const contextValue = useMemo(() => {
    const applyEntryToDom = (key, record, entry) => {
      if (typeof document === 'undefined') return
      let element = record.element

      if (!element || element.tagName.toLowerCase() !== entry.type) {
        if (element?.parentNode) {
          element.parentNode.removeChild(element)
        }
        element = document.createElement(entry.type)
        element.setAttribute(MANAGED_KEY_ATTR, key)
        document.head.appendChild(element)
        record.element = element
      }

      const attributeNames = Array.from(element.attributes)
        .map((attr) => attr.name)
        .filter((name) => name !== MANAGED_KEY_ATTR)

      attributeNames.forEach((name) => {
        element.removeAttribute(name)
      })

      Object.entries(entry.props || {}).forEach(([name, value]) => {
        if (value !== undefined && value !== null) {
          element.setAttribute(name, value)
        }
      })

      if (entry.textContent !== undefined) {
        element.textContent = entry.textContent
      } else if (element.textContent) {
        element.textContent = ''
      }
    }

    const upsertElement = ({ key, owner, type, props = {}, textContent }) => {
      if (typeof document === 'undefined') return null
      if (!key || !owner) {
        throw new Error('upsertElement requires a key and owner')
      }

      let record = elementsRef.current.get(key)
      if (!record) {
        record = createRecord()
        elementsRef.current.set(key, record)
      }

      const entry = { type, props, textContent }
      record.entries.set(owner, entry)
      record.order = record.order.filter((existingOwner) => existingOwner !== owner)
      record.order.push(owner)
      applyEntryToDom(key, record, entry)
      return record.element
    }

    const removeElement = ({ key, owner }) => {
      const record = elementsRef.current.get(key)
      if (!record || !record.entries.has(owner)) {
        return
      }

      record.entries.delete(owner)
      record.order = record.order.filter((existingOwner) => existingOwner !== owner)

      if (record.order.length === 0) {
        if (record.element?.parentNode) {
          record.element.parentNode.removeChild(record.element)
        }
        elementsRef.current.delete(key)
        return
      }

      const nextOwner = record.order[record.order.length - 1]
      const nextEntry = record.entries.get(nextOwner)
      if (nextEntry) {
        applyEntryToDom(key, record, nextEntry)
      }
    }

    const setTitle = (owner, value) => {
      if (typeof document === 'undefined') return
      if (!owner) {
        throw new Error('setTitle requires an owner')
      }

      const state = titleStateRef.current
      state.values.set(owner, value)
      state.order = state.order.filter((existingOwner) => existingOwner !== owner)
      state.order.push(owner)
      document.title = value
    }

    const removeTitle = (owner) => {
      if (typeof document === 'undefined') return
      const state = titleStateRef.current
      if (!state.values.has(owner)) return

      state.values.delete(owner)
      state.order = state.order.filter((existingOwner) => existingOwner !== owner)

      const nextOwner = state.order[state.order.length - 1]
      if (nextOwner) {
        const nextTitle = state.values.get(nextOwner)
        if (typeof nextTitle === 'string') {
          document.title = nextTitle
          return
        }
      }

      document.title = state.defaultTitle
    }

    return {
      upsertElement,
      removeElement,
      setTitle,
      removeTitle,
    }
  }, [])

  return <HeadContext.Provider value={contextValue}>{children}</HeadContext.Provider>
}

export const useHeadManager = () => {
  const context = useContext(HeadContext)
  if (!context) {
    throw new Error('useHeadManager must be used within a HeadProvider')
  }
  return context
}

export default HeadProvider
