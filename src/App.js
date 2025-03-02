import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import AWS from "aws-sdk";
import "./App.css";

// AWS Configuration
AWS.config.update({
  accessKeyId: "",
  secretAccessKey: "",
  region: "ap-south-1"
});

const sns = new AWS.SNS();
const s3 = new AWS.S3();
const BUCKET_NAME = "earthquake-sensor";
const FOLDER_NAME = "detections";
const PHONE_NUMBER = "+";

const Card = ({ children, className }) => {
  return <div className={`card ${className}`}>{children}</div>;
};

const sendSMSAlert = (message) => {
  const params = {
    Message: message,
    PhoneNumber: PHONE_NUMBER
  };
  sns.publish(params, (err, data) => {
    if (err) {
      console.error("Error sending SMS:", err);
    } else {
      console.log("SMS sent successfully:", data);
    }
  });
};

const App = () => {
  const [earthquakeData, setEarthquakeData] = useState([]);
  const [directData, setDirectData] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const listParams = {
          Bucket: BUCKET_NAME,
          Prefix: `${FOLDER_NAME}/`
        };
        const listedObjects = await s3.listObjectsV2(listParams).promise();
        
        const fileKeys = listedObjects.Contents.map(obj => obj.Key);
        
        const requests = fileKeys.map(async key => {
          const params = {
            Bucket: BUCKET_NAME,
            Key: key
          };
          const fileData = await s3.getObject(params).promise();
          return JSON.parse(fileData.Body.toString("utf-8"));
        });
        
        const allData = await Promise.all(requests);
        setEarthquakeData(allData.flat());
        
        if (allData.length > 0) {
          sendSMSAlert("Alert! Alert! Alert. New Earthquake detected.");
        }
      } catch (error) {
        console.error("Error fetching earthquake data:", error);
      }
    };

    const fetchDirectData = async () => {
      try {
        const listParams = {
          Bucket: BUCKET_NAME
        };
        const listedObjects = await s3.listObjectsV2(listParams).promise();
        const fileKeys = listedObjects.Contents.map(obj => obj.Key).filter(key => key.endsWith('.json'));
        
        const requests = fileKeys.map(async key => {
          const params = {
            Bucket: BUCKET_NAME,
            Key: key
          };
          const fileData = await s3.getObject(params).promise();
          return JSON.parse(fileData.Body.toString("utf-8"));
        });
        
        const allData = await Promise.all(requests);
        setDirectData(allData.flat());
      } catch (error) {
        console.error("Error fetching direct data:", error);
      }
    };

    fetchAllData();
    fetchDirectData();
  }, []);

  return (
    <div className="container">
      <h1 className="title">Live Earthquake Tracker</h1>
      <div className="content">
        <MapContainer center={[20, 0]} zoom={2} className="map">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {earthquakeData.map((data, index) => (
            data.latitude && data.longitude ? (
              <Marker key={index} position={[data.latitude, data.longitude]}>
                <Popup>
                  <strong>Location:</strong> {data.location} <br />
                  <strong>Hazard:</strong> {data.hazardType} <br />
                  <strong>Confidence:</strong> {data.predictions?.[0]?.confidence?.toFixed(2) || "N/A"}
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>

        <div className="alerts">
          <h2 className="alerts-title">Alerts</h2>
          {earthquakeData.map((data, index) => (
            <Card key={index} className="alert-card">
              <p><strong>Location:</strong> {data.location || "Unknown"}</p>
              <p><strong>Hazard:</strong> {data.hazardType || "N/A"}</p>
              <p><strong>Time:</strong> {data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A"}</p>
            </Card>
          ))}
        </div>

        {directData.length > 0 && (
          <div className="direct-data">
            <h2 className="direct-data-title">ESP32 Threat Data</h2>
            <div className="direct-data-grid">
              {directData.map((data, index) => (
                <Card key={index} className="direct-data-card">
                  <p><strong>AF:</strong> {data.af}</p>
                  <p><strong>IIF:</strong> {data.iif}</p>
                  <p><strong>Data From:</strong> {data.data_from}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
