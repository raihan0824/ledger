#!/bin/bash

# Finance Dashboard - Kubernetes Deployment Script
# This script deploys all resources to your Kubernetes cluster

set -e

NAMESPACE="finance-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying Finance Dashboard to Kubernetes..."

# Create namespace
echo "📦 Creating namespace..."
kubectl apply -f "${SCRIPT_DIR}/namespace.yaml"

# Apply ConfigMaps
echo "📋 Applying ConfigMaps..."
kubectl apply -f "${SCRIPT_DIR}/configmap.yaml"

# Apply Secrets (make sure to update with real values first!)
echo "🔐 Applying Secrets..."
kubectl apply -f "${SCRIPT_DIR}/secret.yaml"

# Deploy backend
echo "🔧 Deploying backend..."
kubectl apply -f "${SCRIPT_DIR}/backend-deployment.yaml"

# Deploy frontend
echo "🎨 Deploying frontend..."
kubectl apply -f "${SCRIPT_DIR}/frontend-deployment.yaml"

# Apply Ingress
echo "🌐 Applying Ingress..."
kubectl apply -f "${SCRIPT_DIR}/ingress.yaml"

# Apply HPA (optional)
echo "📈 Applying HPA..."
kubectl apply -f "${SCRIPT_DIR}/hpa.yaml"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Checking deployment status..."
kubectl -n ${NAMESPACE} get pods
echo ""
kubectl -n ${NAMESPACE} get services
echo ""
echo "🔗 To access the dashboard locally:"
echo "   kubectl -n ${NAMESPACE} port-forward svc/frontend-service 8080:8080"
echo "   Then open: http://localhost:8080"
