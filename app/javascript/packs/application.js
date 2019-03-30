require('channels')

import { Application } from 'stimulus'
import { definitionsFromContext } from 'stimulus/webpack-helpers'
import consumer from '../channels/consumer'

(function() {
  this.VTT || (this.VTT = {})
  
  const application = Application.start()
  const context = require.context('../controllers', true, /\.js$/)
  application.load(definitionsFromContext(context))
  
  this.VTT.application = application
  
  this.VTT.actionCable = consumer
  for (let subscription of consumer.subscriptions.subscriptions) {
    subscription.application = application
  }
  
  this.VTT.turboLinks    = require('turbolinks')
  this.VTT.turboLinks.start()
  
  this.VTT.ujs = require('@rails/ujs')
  this.VTT.ujs.start()
  
  this.VTT.trix       = require('trix')
  this.VTT.actionText = require('@rails/actiontext')
  
  this.VTT.activeStorage = require('@rails/activestorage')
  this.VTT.activeStorage.start()
  
  Object.defineProperty(this.VTT, 'modal', {
    get: function() {
      let element = document.querySelector('[data-controller*="modal"]')
      return element &&
             window.VTT.application
                   .getControllerForElementAndIdentifier(element, 'modal')
    }
  })
  
  Object.defineProperty(this.VTT, 'editor', {
    get: function() {
      let element = document.querySelector('[data-controller*="map-editor"]')
      return element &&
             window.VTT.application
                   .getControllerForElementAndIdentifier(element, 'map-editor')
    }
  })
  
  Object.defineProperty(this.VTT, 'player', {
    get: function() {
      let element = document.querySelector('[data-controller*="map-player"]')
      return element &&
             window.VTT.application
                   .getControllerForElementAndIdentifier(element, 'map-player')
    }
  })
}).call(window)