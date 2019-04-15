import ApplicationController from 'controllers/application_controller'
import playerChannel from 'channels/player_channel'
import Peer from 'simple-peer'
import _ from 'underscore'

// Broadcast Types
const ADD_PARTICIPANT    = 'ADD_PARTICIPANT'
const EXCHANGE_SIGNAL    = 'EXCHANGE_SIGNAL'
const REMOVE_PARTICIPANT = 'REMOVE_PARTICIPANT'

const ice = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

export default class extends ApplicationController {
  
  static targets = ['host', 'participant', 'devices']
  
  get mediaConstraints () {
    return this._mediaConstraints || (this._mediaConstraints = {
      audio: true,
      video: true
    })
  }
  
  set mediaConstraints (v) {
    this._mediaConstraints = v
  }
  
  get hostId () {
    return this.hostTarget.dataset.participantId
  }
  
  get hostVideo () {
    return this.hostTarget.querySelector('video')
  }
  
  connect () {
    this.channel = playerChannel
    this.channel.playerId = parseInt(this.hostId)
    
    this.announceParticipation = this.announceParticipation.bind(this)
    this.join = this.join.bind(this)
    this.leave = this.leave.bind(this)
    
    _.defer(this.leave)
    _.defer(this.announceParticipation)
  }
  
  disconnect () {
    this.leave()
    window.removeEventListener('unload', this.leave)
  }
  
  stopCapture () {
    if (this.hostStream) {
      for (const [participantId, peer] of Object.entries(this.channel.peers)) {
        if (participantId !== this.hostId && peer) {
          peer.removeStream(this.hostStream)
        }
      }
      
      for (let track of this.hostStream.getTracks()) track.stop()
      delete this.hostStream
    }
  }
  
  join () {
    this.announceParticipation()
    
    navigator.mediaDevices
             .getUserMedia(this.mediaConstraints)
             .then(this.streamMedia.bind(this))
  }
  
  leave () {
    this.sendBroadcast({
      type: REMOVE_PARTICIPANT,
      from: this.hostId
    })
    
    this.channel.disconnectAllPeers()
    
    this.hostVideo.srcObject = null
    this.stopCapture()
  }
  
  announceParticipation() {
    this.sendBroadcast({
      type: ADD_PARTICIPANT,
      from: this.hostId
    })
  }
  
  sendBroadcast (data = {}) {
    this.channel.sendVideoChatBroadcast(data)
  }
  
  receiveBroadcast (data) {
    let { type, from, to } = data
    
    switch (type) {
      case ADD_PARTICIPANT:
        this.getParticipant(from)
        break
      
      case REMOVE_PARTICIPANT:
        this.removeParticipant(from)
        break
      
      case EXCHANGE_SIGNAL:
        if (to == this.hostId) this.receiveSignal(from, data.signal)
        break
      
      default:
        console.warn('Unsupported broadcast type', type)
        break
    }
  }
  
  broadcastSignal (participantId, data) {
    const signal = JSON.stringify(data)
    this.sendBroadcast({
      type:   EXCHANGE_SIGNAL,
      from:   this.hostId,
      to:     participantId,
      signal: signal
    })
  }
  
  receiveSignal (participantId, signal) {
    const peer = this.getParticipant(participantId)
    peer.signal(signal)
    
    const element = this.getParticipantElement(participantId)
    if (element) element.style.display = 'block'
  }
  
  getParticipant (participantId) {
    if (!this.channel.peers[participantId]) {
      const initiator = [participantId, this.hostId].sort()[0] == this.hostId
      const stream = participantId !== this.hostId && this.hostStream
      const peer = this.channel.peers[participantId] = new Peer({ initiator: initiator, stream: stream })
      
      peer.on('signal', (signal) => this.broadcastSignal(participantId, signal))
      
      peer.on('data',    (d) => console.log(`received: ${d}`))
      peer.on('connect', () => peer.send(`connected ${participantId} with ${this.hostId}`))
      
      peer.on('stream', (stream) => this.streamParticipantVideo(participantId, stream))
      
      this.announceParticipation()
    }
    
    return this.channel.peers[participantId]
  }
  
  removeParticipant (participantId) {
    const participant = this.getParticipantElement(participantId)
    
    if (participant) {
      const video = this.getParticipantVideo(participantId)
      participant.style.display = 'none'
      
      if (video) {
        video.pause()
        video.srcObject = null
        video.load()
      }
    }
    
    this.channel.disconnectPeer(participantId)
  }
  
  streamMedia (stream) {
    this.streamToVideo(stream, this.hostVideo, true)
    this.hostStream = stream
    
    for (const [participantId, peer] of Object.entries(this.channel.peers)) {
      if (participantId !== this.hostId && peer) {
        peer.addStream(stream)
      }
    }
    
    if (!this.devices) {
      this.gatherDevices()
    }
  }
  
  streamToVideo (stream, video, muted = false) {
    if (stream && video) {
      video.srcObject = stream
      video.muted = muted
      video.autoplay = 'autoplay'
      video.playsinline = 'playsinline'
    }
  }
  
  changeDevice () {
    if (this.hostStream) {
      this.stopCapture()
      
      this.mediaConstraints = _.extend(this.mediaConstraints, { video: { deviceId: { exact: this.devicesTarget.value } } })
      this.join()
    }
  }
  
  gatherDevices () {
    navigator.mediaDevices.enumerateDevices().then(this.gotDevices.bind(this))
  }
  
  gotDevices (devices) {
    this.devices = devices.filter((device) => device.kind == 'videoinput')
    
    if (this.hasDevicesTarget) {
      let select = this.devicesTarget
      select.innerHTML = ''
      
      this.devices.forEach((device, i) => {
        let option = document.createElement('option')
        option.value = device.deviceId
        
        let label = document.createTextNode(device.label || `Camera ${i + 1}`)
        option.appendChild(label)
        select.appendChild(option)
      })
      
      if (this.devices.length > 1) {
        select.style.display = 'inline'
      } else {
        select.style.display = 'none'
      }
    }
  }
  
  streamParticipantVideo (participantId, stream) {
    const video = this.getParticipantVideo(participantId)
    this.streamToVideo(stream, video)
  }
  
  getParticipantElement (participantId) {
    return this.participantTargets.find((el) => el.dataset.participantId == participantId)
  }
  
  getParticipantVideo (participantId) {
    const participant = this.getParticipantElement(participantId)
    return participant && participant.querySelector('video')
  }
}
