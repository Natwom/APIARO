"""
SMS Service Module for Kenya E-Commerce
Supports mock mode for development and ready for Africa's Talking integration
"""

import os
import logging
from typing import Optional
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SMSServiceInterface(ABC):
    """Abstract base class for SMS services"""
    
    @abstractmethod
    def send_sms(self, phone_number: str, message: str) -> dict:
        pass

class MockSMSService(SMSServiceInterface):
    """
    Mock SMS Service for development and testing
    Logs messages instead of sending them
    """
    
    def send_sms(self, phone_number: str, message: str) -> dict:
        """Simulate sending SMS by logging to console"""
        try:
            # Validate Kenya phone number format
            if not self._validate_kenya_number(phone_number):
                return {
                    "success": False,
                    "messageId": None,
                    "error": "Invalid Kenya phone number format. Use +254XXXXXXXXX"
                }
            
            # Log the SMS (in production, this would be an actual API call)
            logger.info(f"📱 MOCK SMS SENT")
            logger.info(f"   To: {phone_number}")
            logger.info(f"   Message: {message}")
            logger.info(f"   Status: SUCCESS (Mock)")
            
            return {
                "success": True,
                "messageId": f"mock_{hash(phone_number + message) % 1000000}",
                "cost": "KES 0.80",
                "status": "Sent"
            }
            
        except Exception as e:
            logger.error(f"Mock SMS Error: {str(e)}")
            return {
                "success": False,
                "messageId": None,
                "error": str(e)
            }
    
    def _validate_kenya_number(self, phone_number: str) -> bool:
        """Validate Kenya phone number format (+254XXXXXXXXX)"""
        if not phone_number.startswith("+254"):
            return False
        if len(phone_number) != 13:  # +254 + 9 digits
            return False
        return phone_number[4:].isdigit()

class AfricasTalkingService(SMSServiceInterface):
    """
    Africa's Talking SMS Integration
    Uncomment and configure when ready for production
    """
    
    def __init__(self):
        self.api_key = os.getenv("AT_API_KEY")
        self.username = os.getenv("AT_USERNAME", "sandbox")
        self.sender_id = os.getenv("AT_SENDER_ID", "KENYASHOP")
        
        try:
            # import africastalking
            # africastalking.initialize(self.username, self.api_key)
            # self.sms = africastalking.SMS
            pass
        except ImportError:
            logger.warning("Africa's Talking SDK not installed")
    
    def send_sms(self, phone_number: str, message: str) -> dict:
        """
        Send SMS via Africa's Talking API
        Uncomment implementation when SDK is installed
        """
        try:
            # response = self.sms.send(message, [phone_number], self.sender_id)
            # return {
            #     "success": True,
            #     "messageId": response["SMSMessageData"]["Recipients"][0]["messageId"],
            #     "cost": response["SMSMessageData"]["Recipients"][0]["cost"]
            # }
            pass
        except Exception as e:
            logger.error(f"Africa's Talking Error: {str(e)}")
            return {"success": False, "error": str(e)}

class SafaricomService(SMSServiceInterface):
    """
    Safaricom M-Pesa SMS Callback Integration
    For future M-Pesa SMS notification integration
    """
    
    def __init__(self):
        self.consumer_key = os.getenv("MPESA_CONSUMER_KEY")
        self.consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
        self.passkey = os.getenv("MPESA_PASSKEY")
        self.shortcode = os.getenv("MPESA_SHORTCODE")
    
    def send_sms(self, phone_number: str, message: str) -> dict:
        """
        Placeholder for Safaricom SMS integration
        This would integrate with M-Pesa SMS callback API
        """
        logger.info("Safaricom SMS service placeholder called")
        return {"success": False, "error": "Not implemented yet"}

class SMSServiceFactory:
    """Factory to get appropriate SMS service based on environment"""
    
    @staticmethod
    def get_service(service_type: Optional[str] = None) -> SMSServiceInterface:
        """
        Get SMS service instance
        
        Args:
            service_type: 'mock', 'africastalking', or None (auto-detect)
        """
        if service_type is None:
            service_type = os.getenv("SMS_SERVICE", "mock").lower()
        
        if service_type == "africastalking":
            return AfricasTalkingService()
        elif service_type == "safaricom":
            return SafaricomService()
        else:
            return MockSMSService()

# ========== PASSWORD RESET SMS FUNCTIONS ==========

def send_password_reset_code(phone_number: str, reset_code: str, service_type: Optional[str] = None):
    """
    Send password reset code via SMS
    
    Args:
        phone_number: Customer phone (+254XXXXXXXXX)
        reset_code: 6-digit reset code
        service_type: SMS service to use
    """
    message = (
        f"Your APIARO password reset code is: {reset_code}. "
        f"Valid for 15 minutes. Do not share this code with anyone."
    )
    
    service = SMSServiceFactory.get_service(service_type)
    result = service.send_sms(phone_number, message)
    
    if result["success"]:
        logger.info(f"Password reset SMS sent successfully to {phone_number}")
    else:
        logger.error(f"Failed to send password reset SMS to {phone_number}: {result.get('error')}")
    
    return result

def send_password_reset_confirmation(phone_number: str, service_type: Optional[str] = None):
    """
    Send password reset confirmation SMS
    """
    message = (
        f"Your APIARO password has been reset successfully. "
        f"If you did not do this, please contact support immediately."
    )
    
    service = SMSServiceFactory.get_service(service_type)
    return service.send_sms(phone_number, message)

# Convenience function for order notifications
def send_order_confirmation(phone_number: str, customer_name: str, order_id: int, service_type: Optional[str] = None):
    """
    Send order confirmation SMS
    
    Args:
        phone_number: Customer phone (+254XXXXXXXXX)
        customer_name: Customer name
        order_id: Order ID
        service_type: SMS service to use
    """
    message = (
        f"Hello {customer_name}, your order #{order_id} has been received successfully. "
        f"Thank you for shopping with us. We will contact you soon for delivery."
    )
    
    service = SMSServiceFactory.get_service(service_type)
    result = service.send_sms(phone_number, message)
    
    if result["success"]:
        logger.info(f"Order confirmation SMS sent successfully to {phone_number}")
    else:
        logger.error(f"Failed to send SMS to {phone_number}: {result.get('error')}")
    
    return result

def send_order_status_update(phone_number: str, customer_name: str, order_id: int, status: str, service_type: Optional[str] = None):
    """
    Send order status update SMS
    """
    status_messages = {
        "paid": "Your payment has been confirmed",
        "shipped": "Your order has been shipped and is on the way",
        "delivered": "Your order has been delivered. Thank you for shopping with us!"
    }
    
    message_body = status_messages.get(status, f"Your order status has been updated to: {status}")
    message = f"Hello {customer_name}, Order #{order_id}: {message_body}"
    
    service = SMSServiceFactory.get_service(service_type)
    return service.send_sms(phone_number, message)