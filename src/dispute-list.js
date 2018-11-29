import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import React from 'react'
import Dispute from './dispute'
import { arbitrableInstanceAt } from './ethereum/arbitrable'
import {
  centralizedArbitratorInstance,
  getArbitrationCost,
  getDispute,
  getDisputeStatus,
  getOwner,
  setArbitrationPrice
} from './ethereum/centralized-arbitrator'

class DisputeList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      disputes: []
    }
    this.subscriptions = {
      disputeCreation: undefined,
      dispute: undefined,
      metaevidence: undefined,
      ruling: undefined
    }
  }

  componentDidMount() {
    this.subscriptions.disputeCreation = centralizedArbitratorInstance(
      this.props.contractAddress
    )
      .events.DisputeCreation({}, { fromBlock: 0, toBlock: 'latest' })
      .on('data', event => {
        this.addDispute(
          event.returnValues._disputeID,
          event.returnValues._arbitrable
        )
      })
      .on('error', console.error)
  }

  componentDidUpdate(prevProps) {
    if (this.props.contractAddress != prevProps.contractAddress) {
      this.subscriptions = {}
      this.state.disputes = []
      this.subscriptions.disputeCreation = centralizedArbitratorInstance(
        this.props.contractAddress
      )
        .events.DisputeCreation({}, { fromBlock: 0, toBlock: 'latest' })
        .on('data', event => {
          this.addDispute(
            event.returnValues._disputeID,
            event.returnValues._arbitrable
          )
        })
        .on('error', console.error)
    }
  }

  updateEvidence = async (disputeID, party, evidence) => {
    const { disputes } = this.state

    const sortedDisputes = disputes.sort(function(a, b) {
      return a.id - b.id
    })

    sortedDisputes[disputeID].evidences[party] =
      sortedDisputes[disputeID].evidences[party] || []

    fetch(evidence).then(response =>
      response
        .json()
        .catch(function() {
          console.log('error')
        })
        .then(data => sortedDisputes[disputeID].evidences[party].push(data))
    )
  }

  updateDispute = async (arbitrableAddress, disputeID, metaEvidenceID) => {
    const { disputes } = this.state

    const sortedDisputes = disputes.sort(function(a, b) {
      return a.id - b.id
    })
    console.log('sortedDisputes')
    console.log(sortedDisputes)
    console.log('disputeID')
    console.log(disputeID)

    this.subscriptions.metaevidence = arbitrableInstanceAt(arbitrableAddress)
      .events.MetaEvidence({
        filter: { _metaEvidenceID: metaEvidenceID },
        fromBlock: 0,
        toBlock: 'latest'
      })
      .on('data', event => {
        fetch(event.returnValues._evidence)
          .then(response =>
            response
              .json()
              .catch(function() {
                console.log('error')
              })
              .then(data => (sortedDisputes[disputeID].metaevidence = data))
          )
          .then(() => this.setState({ disputes: sortedDisputes }))
      })
  }

  updateRuling = async event => {
    const { disputes } = this.state
    disputes[parseInt(event.returnValues._disputeID)].ruling =
      event.returnValues[3]
    disputes[event.returnValues._disputeID].status = await getDisputeStatus(
      event.returnValues._disputeID
    )
    this.setState({ disputes: disputes })
  }

  addDispute = async (disputeID, arbitrableAddress) => {
    const dispute = await getDispute(
      centralizedArbitratorInstance(this.props.contractAddress),
      disputeID
    )
    // dispute.key = disputeID
    dispute.id = disputeID
    dispute.evidences = {}

    this.setState(state => ({
      disputes: [...state.disputes, dispute]
    }))

    this.subscriptions.dispute = await arbitrableInstanceAt(arbitrableAddress)
      .events.Dispute({
        filter: {
          _arbitrator: this.props.contractAddress,
          _disputeID: disputeID
        },
        fromBlock: 0,
        toBlock: 'latest'
      })
      .on('data', event => {
        this.updateDispute(
          arbitrableAddress,
          event.returnValues._disputeID,
          event.returnValues._metaEvidenceID
        )
      })

    this.subscriptions.evidence = await arbitrableInstanceAt(arbitrableAddress)
      .events.Evidence({
        filter: {
          _arbitrator: this.props.contractAddress,
          _disputeID: disputeID
        },
        fromBlock: 0,
        toBlock: 'latest'
      })
      .on('data', event => {
        this.updateEvidence(
          disputeID,
          event.returnValues._party,
          event.returnValues._evidence
        )
      })

    this.subscriptions.ruling = await arbitrableInstanceAt(arbitrableAddress)
      .events.Ruling({
        filter: {
          _arbitrator: this.props.contractAddress,
          _disputeID: disputeID
        },
        fromBlock: 0,
        toBlock: 'latest'
      })
      .on('data', event => {
        this.updateRuling(event)
      })
  }

  disputes = items =>
    items
      .filter(dispute => dispute.status !== '2')
      .sort(function(a, b) {
        return a.id - b.id
      })
      .map(item => (
        <Dispute
          activeWallet={this.props.activeWallet}
          networkType={this.props.networkType}
          centralizedArbitratorInstance={centralizedArbitratorInstance(this.props.contractAddress)}
          arbitrated={item.arbitrated}
          choices={item.choices}
          evidences={item.evidences}
          fee={item.fee}
          id={item.id}
          key={item.id}
          metaevidence={item.metaevidence || 'NO META EVIDENCE'}
          status={item.status || '0'}
        />
      ))

  render() {
    return (
      <div>
        <h1>
          <b>Disputes That Await Your Arbitration</b>
        </h1>

        <table className="table table-hover" id="disputes">
          <thead>
            <tr className="secondary">
              <th>ID</th>
              <th>Arbitrable</th>
              <th>Fee (Ether)</th>
              <th>Status</th>
              <th>
                <FontAwesomeIcon icon="gavel" />
              </th>
            </tr>
          </thead>

          {this.disputes(this.state.disputes)}
        </table>
      </div>
    )
  }
}

DisputeList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired
}

export default DisputeList
