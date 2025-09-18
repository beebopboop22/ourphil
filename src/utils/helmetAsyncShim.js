import React from 'react'
import { Helmet as ReactHelmet } from 'react-helmet'

export const HelmetProvider = ({ children }) => <>{children}</>

export const Helmet = (props) => <ReactHelmet {...props} />
