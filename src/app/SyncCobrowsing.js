import './SyncCobrowsing.css';

import React from 'react';
import SyncClient from 'twilio-sync';
import axios from 'axios';

import Participants from './Participants.js'

class SyncCobrowsing extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: 'Connecting...',
      errorMessage: '',
      participants: [],
      formData: {
        firstName: '',
        lastName: '',
        phoneNumber: '',
        subscribeToMailingList: false
      }
    };
  }

  componentDidMount() {
    // fetch an access token from the localhost server
    this.retrieveToken(this.props.identity);
  }

  async retrieveToken(identity) {
    let result = await axios.get('/token/' + this.props.identity);
    let accessToken = result.data.token;
    if (accessToken != null) {
      if (this.client) {
        // update the sync client with a new access token
        this.refreshSyncClient(accessToken);
      } else {
        // create a new sync client
        this.createSyncClient(accessToken);
      }
    } else {
      this.setState({'errorMessage':'No access token found in result'});
    }
  }

  updateSyncDocument(formData) {
    if (!this.client) {
      return;
    }
    this.client.document(this.props.sessionId).then(function(doc) {
      doc.set(formData);
    });
  }

  getParticipantsKey() {
    return 'participants-' + this.props.sessionId;
  }

  addParticipant(identity) {
    this.client.map(this.getParticipantsKey()).then(function(map) {
      map.set(identity, {
        identity: identity
      }).then(function(item) {
        console.log('Added: ', item.key);
      }).catch(function(err) {
        console.error(err);
      });
    });
  }

  async subscribeToParticipantsUpdates() {
    var component = this;
    this.client.map(this.getParticipantsKey()).then(function(map) {
      map.on('itemAdded', function(event) {
        component.refreshParticipants(map);
      });

      map.on('itemUpdated', function(event) {
        component.refreshParticipants(map);
      });

      map.on('itemDeleted', function(event) {
        component.refreshParticipants(map);
      });
      
    });
  }

  refreshParticipants(map) {
    this.getAllItems(map).then(items => {
      var participants = [];
      items.forEach(item => {
        participants.push(item.value);
      });
      console.log('participants', participants);
      this.setState({participants: participants});
    });
  }

  // Since Sync Map has pagination we need to navigate through all the pages
  async getAllItems(map) {
      const result = [];
      let page = await map.getItems();
      result.push(...page.items);

      while (page.hasNextPage) {
          page = await page.nextPage();
          result.push(...page.items);
      }
      return result;
  };

  refreshSyncClient(token) {
    this.client.updateToken(token);
  }

  createSyncClient(token) {
    const client = new SyncClient(token, { logLevel: 'info' });
    var component = this;
    let identity = this.props.identity;
    client.on('connectionStateChanged', function(state) {
        if (state === 'connected') {
            component.client  = client;
            component.setState({status:'connected'});
            component.loadFormData();
            component.subscribeToParticipantsUpdates();
            component.addParticipant(identity);
        } else {
          component.setState({
            status:'error', 
            errorMessage:`Error: expected connected status but got ${state}`
          });
        }
    });
    client.on('tokenAboutToExpire', function() {
      component.retrieveToken(identity);
    });
    client.on('tokenExpired', function() {
      component.retrieveToken(identity);
    });
  }

  async loadFormData() {
    let component = this;

    this.client.document(this.props.sessionId).then(function(doc) {
      component.setState({formData: doc.value});

      doc.on("updated",function(data) {
        console.log('Sync Updated Data', data);
        if (!data.isLocal) {
          component.setState({formData: data.value});
        }
      });
    
    });
  }

  setFormValue(fieldName,value) {
    var formData = this.state.formData;
    formData[fieldName] = value;
    this.setState({formData: formData}, () => this.updateSyncDocument(formData));
  }

  render() {
    return (
      <React.Fragment>
        <div className="container">
            <div className="card border-primary">
                <div className="card-header text-info">
                    <span id="status">{this.state.status}</span>
                </div>
                <div className="card-header text-info">
                    Participants:<br />
                    <Participants participants={this.state.participants}/>
                </div>
            </div>
            <div className="card border-primary">
                <div className="card-header text-info">
                  <div className="input-group mb-3">
                      <input onFocus={(e) => {
                        console.log('onFocus');
                      }}
                      onBlur={(e) => {
                        this.setFormValue('firstName',e.target.value);
                      }}
                      
                      id="firstName" type="text" defaultValue={this.state.formData.firstName} className="form-control cb-input" placeholder="First Name"/>
                    </div>
                    <div className="input-group mb-3">
                      <input onFocus={(e) => {
                        console.log('onFocus');
                      }}
                      onBlur={(e) => {
                        this.setFormValue('lastName',e.target.value);
                      }}
                      id="lastName" type="text" defaultValue={this.state.formData.lastName} className="form-control cb-input" placeholder="Last Name"/>
                    </div>
                </div>
            </div>

        </div>
        <span id="floating-badges"></span>
        <span id="signals"></span>
      </React.Fragment>
    );
  }

}

export default SyncCobrowsing;