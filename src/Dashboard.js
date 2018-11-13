import web3 from './ethereum/web3'
import React from 'react';
import {arbitratorInstance, getOwner, getArbitrationCost, getDispute, getDisputeStatus, setArbitrationPrice} from './ethereum/centralizedArbitrator'
import {arbitrableInstanceAt} from './ethereum/multipleArbitrableTransaction'
import Disputes from './Disputes'

class Dashboard extends React.Component {
  constructor() {
    super()
    this.state = {
      owner: "",
      arbitrationCost: "",
      disputes: [],
      metaEvidences: {}
    }

  }
  async componentDidMount(){
    const owner = await getOwner()
    const arbitrationCost = await getArbitrationCost("")
    this.setState({owner, arbitrationCost})

    let result
    arbitratorInstance.events.DisputeCreation({}, {fromBlock: 0, toBlock: "latest"})
    .on('data', (event) => {
        this.addDispute(event.returnValues._disputeID, event.returnValues._arbitrable)
    })
    .on('changed', function(event){
        // remove event from local database
    })
    .on('error', console.error);

  }

  updateMetaEvidence = async (event) => {
    console.log(event)
    let metaEvidences = this.state.metaEvidences
    metaEvidences[parseInt(event.returnValues._metaEvidenceID)] = "event.returnValues._evidence"
    this.setState({metaEvidences: metaEvidences})
  }

  updateEvidence = async (event) => {
    console.log(event)

  }

  updateDispute = (arbitrableAddress, disputeID, metaEvidenceID) => {
    console.warn("Inside Update Dispute")

    let disputes = this.state.disputes

    arbitrableInstanceAt(arbitrableAddress).events.MetaEvidence({filter: {_metaEvidenceID: metaEvidenceID} ,fromBlock: 0, toBlock: "latest"})
      .on('data', (event) => {
        console.warn("MetaEvidence")
        console.log(event)
        fetch(event.returnValues._evidence)
        .then(response =>
          response.json().then(data =>
          disputes[disputeID].metaevidence = data))
        .then(
          this.setState({disputes: disputes})
        )
      })

    console.log(this.state.disputes)
    console.warn("Exit Update Dispute")

  }


  updateRuling = async (event) => {
    let disputes = this.state.disputes
    disputes[parseInt(event.returnValues._disputeID)].ruling = event.returnValues[3]
    disputes[event.returnValues._disputeID].status = await getDisputeStatus(event.returnValues._disputeID)
    this.setState({disputes: disputes})
  }



  addDispute = async (disputeID, arbitrableAddress) => {

    let disputes = this.state.disputes

    let dispute = await getDispute(disputeID)
    dispute.key = disputeID
    console.log(dispute)
    const length = disputes.push(dispute)

    arbitrableInstanceAt(arbitrableAddress).events.Dispute({filter: {_arbitrator: arbitratorInstance.options.address, _disputeID: disputeID}, fromBlock: 0, toBlock: "latest"})
    .on('data', (event) => {
      console.warn("Calling updateDispute")
      console.log(event)
      this.updateDispute(arbitrableAddress, event.returnValues._disputeID, event.returnValues._metaEvidenceID)
    })

    arbitrableInstanceAt(arbitrableAddress).events.Ruling({filter: {_arbitrator: arbitratorInstance.options.address, _disputeID: disputeID}, fromBlock: 0, toBlock: "latest"})
    .on('data', (event) => {
      this.updateRuling(event)
    })




    this.setState({disputes: disputes})
  }


  setArbitrationCost = async (newCost) => {
    this.setState({arbitrationCost: "awaiting..."})
    await setArbitrationPrice(newCost)
    const arbitrationCost = await getArbitrationCost("")
    this.setState({arbitrationCost})
  }


  render() {
    return (
      <div>
        <h4>Owner: {web3.eth.accounts[0] == this.state.owner ? "You" : this.state.owner}</h4>
        <h4>Arbitrator: <a href={"https://kovan.etherscan.io/address/" + arbitratorInstance.options.address} target="_blank" rel="noopener noreferrer">{arbitratorInstance.options.address}</a></h4>
        <form onSubmit={(e) => {e.preventDefault();this.setArbitrationCost(this.state.arbitrationCost)}}>
          <label>
            Arbitration Price: <input type="text" value={this.state.arbitrationCost} onChange={(e) => {this.setState({arbitrationCost: e.target.value})}} />
            <input type="submit" value="Change Price" />
          </label>
        </form>
        <br/>
        <Disputes items={this.state.disputes}/>
      </div>
    )
  }
}

export default Dashboard
