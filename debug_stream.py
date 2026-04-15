import requests
import json
import sseclient

def debug_stream():
    url = "http://localhost:8090/api/debate/stream?topic=Test"
    print(f"Connecting to {url}...")
    
    response = requests.get(url, stream=True)
    client = sseclient.SSEClient(response)
    
    print("Connected. Listening for events...")
    for event in client.events():
        print(f"Event: {event.event}")
        print(f"Data: {event.data}")
        
        if event.data:
            try:
                data = json.loads(event.data)
                if data.get("type") == "error":
                    print("ERROR RECEIVED!")
                    break
                if data.get("content") == "finished":
                    print("Finished.")
                    break
            except:
                pass

if __name__ == "__main__":
    debug_stream()
